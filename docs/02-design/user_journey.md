# User Journey: Dormitory Parcel Management System

## 1. Journey — Staff: Parcel Check-In

| Step | Action |
|---|---|
| 1. Parcel arrives at the counter | Pick up the parcel and prepare to scan it |
| 2. Scan the parcel barcode | Scan the tracking barcode with the scanner |
| 3. Identify the recipient's room | Type the name/room number and select from the autocomplete, which is validated against the official resident directory |
| 4. Confirm and save | Confirm to save the record into the system |
| 5. Set the parcel aside for pickup | Place it with the other pending parcels |

## 2. Journey — Resident: Parcel Pickup

| Step | Action |
|---|---|
| 1. Learns a parcel has arrived | Gets a phone notification the moment staff check it in, or opens the Resident page (`/resident/`) to see the room's Pending parcels — then goes to the parcel counter. *(Registration once beforehand: enter the room number on `/resident/`, accept the consent notice, and type the 6-digit code staff read out at the counter.)* |
| 2. Provides information to staff | States their room number/name so staff can search for it |
| 3. Waits while staff search and retrieve the parcel | Waits at the counter |
| 4. Receives the parcel | Checks the parcel and receives it from staff |

## 3. Journey — Admin: Setting up and keeping the directory current

| Step | Action |
|---|---|
| 1. System is installed at the dormitory | The team runs `createadmin` once and hands the first Admin login to the dormitory manager in person |
| 2. Register the desk team | Admin opens **ลงทะเบียนผู้ใช้** and creates one login per Staff member (role Staff), or another Admin |
| 3. Load the resident list | Admin opens **จัดการผู้พัก**, downloads the template (or the current list), fills in `room_number,full_name,phone` in Excel and saves it as **CSV UTF-8** |
| 4. Check before saving | Admin uploads the file and reads the preview: added / moved / moved out / new rooms, any error lines, and a warning for Residents who still have Pending parcels |
| 5. Confirm | Admin confirms; Check-In now validates against the new list. Repeat steps 3-5 whenever Residents move in, change rooms or move out |
