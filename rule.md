{Company name} — Legal & Compliance Rules for AI Agents
# {Company} — Legal & Compliance Rules (rule.md)
Read this before writing any code that touches user data or user actions.

## PDPA (Personal Data Protection Act)
What it is: A data privacy law requiring us to get explicit permission before collecting data, use it only for stated purposes, and provide users with the ability to manage or delete their own information.
What it requires: consent · purpose limit · minimise · access/correct/delete · sensitive data
Rules for the agent (write as many as you can):
- If the system stores ___, it must ___
- If the system uses ___, it must ___

## Computer Crime Act §26
What it is: A cybersecurity law requiring service providers to retain system access and traffic logs for at least 90 days to ensure user actions can be traced during an investigation.
What it requires: keep an access/traffic log ≥90 days, tied to a real user
Rules for the agent:
- If the system has ___, it must log ___
- ___

## Electronic Transactions Act §9 / 26 / 28
What it is: A law that validates online transactions and agreements (like clicking an "I agree" button) as legally binding, provided the system captures reliable digital evidence of the action.
What it requires: valid e-signature test (§9) · presumed-reliable signature (§26) · CA duties (§28)
Rules for the agent:
- If the user clicks "I agree" on ___, the system must record ___
- __