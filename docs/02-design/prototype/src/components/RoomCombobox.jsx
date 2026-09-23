import React, { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { C, bodyFont } from "./shared";
import { api, ApiError } from "../api/client";

const DEBOUNCE_MS = 200;
const MIN_CHARS = 1;

function entryLabel(entry) {
  const place = `${entry.buildingCode}${entry.roomNumber}`;
  const names = (entry.residents || []).map((r) => r.fullName);
  return names.length ? `${place} · ${names.join(" / ")}` : place;
}

// Room Number is never free text: `value` is either null or a RoomHit chosen from the directory
// (GET /rooms/search), and `onChange` always receives one of those two, never a typed string.
const RoomCombobox = forwardRef(function RoomCombobox(
  { value, onChange, label, compact = false, autoFocus = false, placeholder = "พิมพ์เลขห้อง หรือชื่อผู้พัก" },
  ref
) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef(null);
  const wantFocus = useRef(false);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const showList = open && query.trim() !== "";

  useImperativeHandle(ref, () => ({
    focus: () => {
      if (inputRef.current) inputRef.current.focus();
      else wantFocus.current = true;
    },
  }));

  // The input is unmounted while a room is selected; focus it once it comes back.
  useEffect(() => {
    if (!value && wantFocus.current && inputRef.current) {
      inputRef.current.focus();
      wantFocus.current = false;
    }
  });

  useEffect(() => {
    const q = query.trim();
    clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    if (q.length < MIN_CHARS) {
      setOptions([]);
      setLoading(false);
      setFailed(false);
      return;
    }
    setLoading(true);
    setFailed(false);
    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      api
        .searchRooms(q, 8, controller.signal)
        .then((res) => {
          setOptions(res.items);
          setLoading(false);
          setActive(0);
        })
        .catch((err) => {
          // A raw AbortError means a newer keystroke superseded this request — not a failure.
          if (err instanceof ApiError) {
            setFailed(true);
            setLoading(false);
          }
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const choose = (entry) => {
    setQuery("");
    setOpen(false);
    setActive(0);
    setOptions([]);
    onChange(entry);
  };

  const clear = () => {
    wantFocus.current = true;
    onChange(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(options.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (showList && options[active]) {
        e.preventDefault();
        choose(options[active]);
      }
    } else if (e.key === "Escape") {
      if (showList) {
        e.preventDefault();
        setOpen(false);
      }
    }
  };

  const sizeClass = compact ? "px-3 py-2 rounded-lg text-sm" : "px-4 py-3.5 rounded-xl text-lg";

  return (
    <div className={label ? "mb-4" : ""}>
      {label && (
        <label htmlFor={`${baseId}-input`} className="block text-sm font-semibold mb-2" style={{ ...bodyFont, color: C.textMuted }}>{label}</label>
      )}
      {value ? (
        <div className={`flex items-center justify-between gap-2 border-2 ${sizeClass}`} style={{ ...bodyFont, borderColor: C.primary, background: C.primaryLight, color: C.text }}>
          <span className="font-semibold truncate">{entryLabel(value)}</span>
          <button type="button" onClick={clear} aria-label="เปลี่ยนห้อง" className="p-1 rounded-lg hover:bg-white flex-shrink-0">
            <X size={16} style={{ color: C.textMuted }} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            id={`${baseId}-input`}
            ref={inputRef}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList && options[active] ? `${baseId}-opt-${active}` : undefined}
            autoFocus={autoFocus}
            autoComplete="off"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`w-full border-2 outline-none focus:ring-2 focus:ring-blue-300 ${sizeClass}`}
            style={{ ...bodyFont, borderColor: C.border, color: C.text }}
          />
          {loading && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin" style={{ color: C.textMuted }} />}
          {showList && !loading && (
            <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full mt-1 z-10 max-h-64 overflow-y-auto rounded-xl border shadow-lg py-1" style={{ background: C.card, borderColor: C.border }}>
              {failed ? (
                <li className="px-4 py-3 text-sm" style={{ ...bodyFont, color: C.warning }}>ค้นหาห้องไม่สำเร็จ ลองใหม่อีกครั้ง</li>
              ) : options.length === 0 ? (
                <li className="px-4 py-3 text-sm" style={{ ...bodyFont, color: C.warning }}>ไม่พบห้องหรือชื่อนี้ในรายชื่อผู้พัก</li>
              ) : (
                options.map((entry, i) => (
                  <li
                    key={entry.id}
                    id={`${baseId}-opt-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      choose(entry);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className="px-4 py-2.5 text-sm cursor-pointer"
                    style={{ ...bodyFont, color: C.text, background: i === active ? C.primaryLight : "transparent" }}
                  >
                    <span className="font-semibold">{entry.buildingCode}{entry.roomNumber}</span>
                    {entry.residents.length > 0 && <span style={{ color: C.textMuted }}> · {entry.residents.map((r) => r.fullName).join(" / ")}</span>}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
});

export default RoomCombobox;
