# Role Statement - Danaiphong Songsikhwa (6631503106)

**Role:** QA / Tester · JOBAS Company #21 · DPMS

## What I owned

I was the tester on our team, so my job was to find out whether the system really works before we call it done.

After the team merged a lot of new code, I ran all 64 test cases again on the latest build. I also tested things a computer can't fake: I scanned real barcodes with the scanner and checked that notifications arrived on real phones, including an iPhone. I wrote the results in a separate Test Result Report and logged every bug with how serious it is and how to reproduce it.

I also added automated tests for user permissions, the main web flows, accessibility and heavy load. The load test ran for 30 minutes with more than 500,000 requests and no errors. These tests found two new problems the team hadn't seen before.

One thing I learned is to check the raw data. When I cleaned the UAT results, I found that three staff members had answered the survey twice, so our first satisfaction score was wrong.

Before testing, I also worked on the Check-In and Check-Out screens.

## Evidence

- Test Result Report: [Test-Result-Report.docx](../../03-test/Test-Result-Report.docx)
- Test Summary Report: [TEST-SUMMARY.md](../../03-test/results/20261116/TEST-SUMMARY.md)
- Defect log: [defects.md](../../03-test/defects.md)
- Automated tests: [rbac_matrix_test.go](../../../backend/internal/api/rbac_matrix_test.go), [e2e/](../../02-design/prototype/e2e/), [load_profile.py](../../03-test/tools/load_profile.py)
- QA action items: [1f6ebbf](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/1f6ebbfcbf271c7327a7ebddc8cb8c4c55c21951)
- Check-In staging: [b1f3d6d](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/b1f3d6df0123bd75c9fc56a1042c46ac66ebc41f)
- Continuous Check-Out scans: [54672d7](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/54672d7a5067af440e9537b585ee359d7d604ae2)

## AI disclosure

I used Claude (Claude Code) in my work. It helped me write the automated tests, run the regression and load tests, look through the UAT data. I still checked every result myself, and I decided how serious each bug was. I did the scanner and phone tests by hand.


## Reflection

### 1. Lessons learned

Honestly, AI changed how our whole team worked. My teammates could write code much faster than before, so new features kept coming in every week. For me as the tester, that meant more things to check, not less.

The part that got better was testing. I don't think I could have written all of our tests by myself in time. With Claude's help I made a test that checks if each type of user can only use the pages they are allowed to, ran tests on three different browsers, and ran a load test for 30 minutes with over 500,000 requests. It also helped with security. A scanning tool found a weakness in one of the Go libraries we used, and once a secret scanner even blocked my own commit because some text looked like a password.

The part that got worse was my own understanding. AI wrote things faster than I could learn them. A few days before the presentation, I realized I couldn't explain some of my own test results, which was a bit embarrassing. So I went back and studied every test case and every document again until I understood them. I also learned that AI mistakes are hard to see because they look correct. For example, our audit log couldn't be edited, but it could still be deleted with one `TRUNCATE` command. I only found it because I tested it myself.

### 2. Where I stand today

Right now I see myself as the person who checks what AI makes. AI can write code, but somebody still has to ask whether it is really safe and whether the results are true, and then show proof. That was my job in this project, and I think this kind of job will matter even more in the future.

### 3. My plan

Next year I want to find a summer internship in cybersecurity. After that I plan to take a cybersecurity certificate, because I want to know the basics myself and not just depend on AI. In five years I hope to be working in cybersecurity, maybe in another country. Testing made me enjoy looking for ways to break a system, and I want to use that to help protect people's data.
