# Role Statement — Phuriphat Chantiuaong (6631503034)

**Role:** UX/UI Designer · JOBAS Company #21 · DPMS

## What I owned

I owned the user experience and visual design of the staff desk and the resident page. I built the first React/Tailwind prototype of the parcel workflow: login, dashboard, check-in/check-out modals and the archive. I then refined it into a consistent design system: design tokens in CSS custom properties, a single Thai/Latin font (Anuphan) and a fixed type scale. I also made the interface more accessible. Every coloured status now carries an icon and a text label, and the focus ring contrast went from 1.73:1 to 4.63:1 to meet WCAG. Later I redesigned the resident notification page to match the staff desk. I also improved check-out with room search and a clearer way to show problem parcels. I recorded these design decisions in `DESIGN.md` and `PRODUCT.md`.

I also went to Baansoi5 Dormitory from 2 to 5 November 2026 to collect user acceptance test (UAT) results from real users: 5 staff and 5 residents. Each participant did the same tasks with the new system and with their existing method (Google Forms/Sheets, or asking at the desk). We timed every task, noted errors and observations, and collected SUS and TAM questionnaires after each session. Both groups rated usability above average (SUS 77.5 for staff and 76.5 for residents; 68 is average). The new system was much faster for finding who collected a parcel (−90%) and for residents seeing that a parcel was picked up (−68%). The sessions also found six defects. The most serious one was that check-out had no room number search, which I fixed in `5da15cc`. Staff U03–U05 then completed the check-out tasks with 0 errors.

## Evidence

- Initial prototype: [a28e5be](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/a28e5be7ac9d46b63a01ea13179d7a412fbf2d0b)
- UI flow + session persistence: [ec63ada](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/ec63ada3bdecf691156e64c796dff352588009f3)
- Design system and accessibility pass: [f6b702f](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/f6b702fdfcdd98b481911af358a65c39496a30b1)
- Resident page redesign: [c261475](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/c2614759b072f2fb144d6d63978f336404c95b70)
- Check-Out room search: [5da15cc](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/5da15ccb67514cae56fe7f91f0caed7c947ab852)
- UAT round 1 results with real users: [docs/03-test/results/20261102-uat/README.md](../../03-test/results/20261102-uat/README.md)
- Design records: [DESIGN.md](../../../DESIGN.md), [PRODUCT.md](../../../PRODUCT.md)

## AI disclosure

I used Claude (Claude Code) to help write and refactor UI code, and the Impeccable design skill to critique the interface. Claude is credited as co-author on the relevant commits. I reviewed, tested and approved every change myself, and all design decisions are mine. Claude also helped draft this statement, and I checked it for accuracy.


## Reflection

**1. Lessons learned.** 
Building DPMS with AI changed the way I work as a designer and developer. Before this project, I spent a lot of time thinking about ideas, designing screens, and writing code. But with AI tools like Claude, I could work much faster.
For example, I could turn a simple idea about the check-in and check-out process into a working React prototype in one session. This helped my team understand the system better because we could test a real prototype instead of only looking at pictures.
One thing that got better was speed. AI helped me build the design system faster and keep the same colors, fonts, and styles across all screens. This saved a lot of time.
However, there were also some problems. Sometimes, AI made mistakes that were difficult to notice. For example, the check-out screen looked complete, but it did not have a room number search feature. We did not find this problem until real staff tested the system during UAT at Baansoi5.
Another problem was the focus ring. Its color contrast was only 1.73:1, which did not meet the WCAG standard.
From this experience, I learned that AI can help us work faster, but it cannot make every decision correctly. We still need to check our work, test with real users, and think about accessibility.
I also learned that teamwork is important. Clear commit messages and AI co-author credits helped the team understand who worked on each part of the project.

**2. Where I stand today.** 
Today, I see myself as a junior designer and developer. I can use AI to help me turn ideas into real applications. I have experience with both design and coding, and I want to improve in both areas.
I think my most important skill is not only writing code. It is also understanding what users need and finding the right way to solve their problems.
AI can help write code and create designs, but it does not always understand real people and their problems. For example, AI cannot sit with dormitory staff and watch how they use a system or where they have problems. I can do that by talking to users and testing the system with them.
I still have many things to learn, especially about software development, problem-solving, and working with other developers.
I believe that using AI together with my own skills will help me become better at my work.

**3. My plan.** 
Next year, I want to finish my degree and get an internship as a Full-stack Developer. I want to improve my skills in both front-end and back-end development.
I want to learn more about building websites, designing user interfaces, working with databases, creating APIs, and connecting the front-end with the back-end. I also want to learn how real development teams work and how they manage projects.
In the next five years, I want to become a skilled Full-stack Developer. I want to be able to build a complete application by myself, from the user interface to the server and database.
I also want to find a stable way to earn money through technology. For example, I could work as a developer, work remotely, take freelance jobs, or build my own software products.
My goal is to use my programming skills to create useful things, solve real problems, and earn money honestly. I want to have a stable career, support myself financially, and continue learning new technologies.
I know that becoming a good developer takes time and practice. I am ready to learn from my mistakes, improve my skills, and work hard to reach my goals.
