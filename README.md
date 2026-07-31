# Remix of Expense It

We need an Expense management platform that replaces spreadsheets and email threads with a structured submission and approval workflow. Employees submit claims through a guided form with receipt uploads, category selection, and notes

We dont want people to be bored - it should be intuitive to use but fun and elevated like a designers opus magnum.  People should be able to submit receipts and expenses with as few clicks as possible, and the admins should be able to see everything they need cleanly and be able to easily approve, reject, and reimburse

React, Tailwind CSS, Framer Motion for all animations. Smooth scroll with Lenis or locomotive-scroll. Micro-interactions on every interactive element.

It should be mobile first and feel like a native app

Feature Mapping:

It should have ALL of the features from @project:ede476f8-1255-49f5-82aa-33e73d1dfdda:"Remix of ExpenseDesk"  but then also add:

Smarter submission: OCR receipt scanning to automatically extract amount, merchant, and date from uploaded receipts so employees don't manually re-enter data

Approval & Workflow Enhancements: Bulk expense reports to group multiple line items into a single trip or project submission for cleaner approval

Policy enforcement: Policy enforcement engine to flag submissions that violate spending rules (ex, meals over $75/person). This means admins should also be able to easily set policies or create policies based on standard practice with AI

Reporting: Custom report builder — let finance teams define their own views and export formats


Persona(s): Finance, Ops, HR, Employees, Contractors

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://effortless-receipt-flow.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/661181a1-ac41-4539-a862-ac35df1c7260).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
