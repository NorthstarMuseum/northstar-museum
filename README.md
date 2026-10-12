# Northstar Museum

Northstar is a museum website we made for our college project. It is not a real museum. We created our own exhibitions, objects and stories. The website also has some small surprises for visitors to find.

## What can you do on the website?

You can look at exhibitions, read about different objects and see upcoming events. You do not need an account to explore the museum.

If you create an account, you can do more:

* Like objects and exhibitions. You can see your likes on your profile.
* Save things you want to look at again.
* Find hidden messages in some objects. Try clicking the **Forgotten Egg** five times.
* Keep track of the secrets you have found.
* Give objects a rating and write a short review.
* Book a museum visit and see your bookings in your account.

There are **18 fictional objects** and **7 hidden surprises** to explore.

## Book a Visit

Go to **Plan Your Visit** and choose a date and time. You can book for 1 to 5 people. You can also cancel a booking from your account.

You do not pay online. The idea is that visitors pay when they arrive at the museum. The admin checks the booking and confirms the payment at the entrance.

After check-in, you get a **digital stamp** for that day. Each date has its own stamp. You can also get badges after 1, 5, 10, 25 and 50 visits.

This is only a school project, so bookings and payments are not real.

## Admin Panel

The admin has a separate page to manage the website. Regular users cannot access it.

The admin can:

* Add, edit or remove exhibitions, events and objects.
* Choose which content visitors can see.
* Check bookings and the number of visitors.
* Change available days and the number of places for each time.
* Confirm payment at the entrance and check visitors in.
* Approve or remove reviews.
* Read contact messages and see basic website statistics.

### How to Create an Admin Account

Open the project folder in VS Code. In the PowerShell terminal, enter:

```powershell
$env:NORTHSTAR_ADMIN_EMAIL="admin@example.com"
$env:NORTHSTAR_ADMIN_PASSWORD="choose-your-own-strong-password"
npm run admin
Remove-Item Env:NORTHSTAR_ADMIN_PASSWORD
```

Change the email and password to your own details. Use a password with at least 10 characters. Do not put your real password in GitHub.

Start the website, log in and open **My Account → Manage Content**. You can also go to `http://localhost:3000/admin`.

## How to Run the Project

You need **Node.js 22.13 or newer**.

Open the Northstar folder in VS Code and run:

```bash
npm run dev
```

Then open `http://localhost:3000` in your browser.

To run the tests:

```bash
npm test
```

## How It Works

We used HTML, CSS and JavaScript for the website, Node.js for the server and SQLite for saving data. The database is created on your computer when you start the project.

The `docs` folder has our project plans, database design, API information and testing notes.

Northstar is a fictional project. The museum, objects and stories were made for this website.
