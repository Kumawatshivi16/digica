document.addEventListener("DOMContentLoaded", function () {

    /* =============================
       DOM ELEMENTS
    ============================== */

    const accountFilter = document.getElementById("accountFilter");

    const totalIncomeEl = document.getElementById("totalIncome");
    const totalExpenseEl = document.getElementById("totalExpense");
    const netBalanceEl = document.getElementById("netBalance");

    const transactionList = document.getElementById("transactionList");
    const creditList = document.getElementById("creditList");

    const totalCreditEl = document.getElementById("totalCredit");
    const pendingCreditEl = document.getElementById("pendingCredit");
    const receivedCreditEl = document.getElementById("receivedCredit");

    const exportBtn = document.getElementById("exportBtn");

    const openTransactionBtn = document.getElementById("openTransactionBtn");
    const closeTransactionBtn = document.getElementById("closeTransactionBtn");
    const transactionModal = document.getElementById("transactionModal");

    const openCreditBtn = document.getElementById("openCreditBtn");
    const closeCreditBtn = document.getElementById("closeCreditBtn");
    const creditModal = document.getElementById("creditModal");

    const transactionForm = document.getElementById("transactionForm");
    const creditForm = document.getElementById("creditForm");

    const themeToggle = document.getElementById("themeToggle");

    /* =============================
       DATA
    ============================== */

    let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
    let credits = JSON.parse(localStorage.getItem("credits")) || [];

    function saveData() {
        localStorage.setItem("transactions", JSON.stringify(transactions));
        localStorage.setItem("credits", JSON.stringify(credits));
    }

    function formatCurrency(amount) {
        return "₹ " + amount.toLocaleString("en-IN");
    }

    /* =============================
       ANIMATE NUMBERS
    ============================== */

    function animateValue(element, start, end, duration = 400) {

        const range = end - start;
        const increment = range / (duration / 16);
        let current = start;

        const timer = setInterval(() => {
            current += increment;

            if ((increment > 0 && current >= end) ||
                (increment < 0 && current <= end)) {
                current = end;
                clearInterval(timer);
            }

            element.textContent = formatCurrency(Math.round(current));
        }, 16);
    }

    /* =============================
       THEME SYSTEM
    ============================== */

    function applyInitialTheme() {
        const savedTheme = localStorage.getItem("theme");

        if (savedTheme) {
            document.body.classList.toggle("dark", savedTheme === "dark");
        } else {
            const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            document.body.classList.toggle("dark", prefersDark);
        }

        updateToggleIcon();
    }

    function updateToggleIcon() {
        themeToggle.textContent =
            document.body.classList.contains("dark") ? "☀️" : "🌙";
    }

    themeToggle.addEventListener("click", function () {
        document.body.classList.toggle("dark");
        const currentTheme =
            document.body.classList.contains("dark") ? "dark" : "light";
        localStorage.setItem("theme", currentTheme);
        updateToggleIcon();
    });

    applyInitialTheme();

    /* =============================
       FILTER HELPERS
    ============================== */

    function getSelectedAccount() {
        return accountFilter.value;
    }

    function getFilteredTransactions() {
        const selected = getSelectedAccount();
        return selected === "All"
            ? transactions
            : transactions.filter(t => t.account === selected);
    }

    function getFilteredCredits() {
        const selected = getSelectedAccount();
        return selected === "All"
            ? credits
            : credits.filter(c => c.account === selected);
    }

    /* =============================
       RENDER TRANSACTIONS
    ============================== */

    function renderTransactions() {

        transactionList.innerHTML = "";

        let totalIncome = 0;
        let totalExpense = 0;

        const filtered = getFilteredTransactions();

        filtered.forEach(transaction => {

            const originalIndex = transactions.indexOf(transaction);

            const li = document.createElement("li");
            li.classList.add("transaction-item");

            const isIncome =
                transaction.type === "Income" || transaction.type === "Sale";

            if (isIncome) totalIncome += transaction.amount;
            else totalExpense += transaction.amount;

            li.innerHTML = `
                <div class="transaction-info">
                    <span><strong>${transaction.account}</strong> | ${transaction.type} - ${transaction.notes || "No notes"}</span>
                    <small>${transaction.date}</small>
                </div>
                <div>
                    <span class="transaction-amount">
                        ${isIncome ? "+" : "-"}${formatCurrency(transaction.amount)}
                    </span>
                    <button class="delete-transaction" data-index="${originalIndex}">
                        Delete
                    </button>
                </div>
            `;

            transactionList.appendChild(li);
        });

        const net = totalIncome - totalExpense;

        animateValue(totalIncomeEl, 0, totalIncome);
        animateValue(totalExpenseEl, 0, totalExpense);
        animateValue(netBalanceEl, 0, net);

        netBalanceEl.classList.toggle("positive", net >= 0);
        netBalanceEl.classList.toggle("negative", net < 0);
    }

    /* =============================
       RENDER CREDITS
    ============================== */

    function renderCredits() {

        creditList.innerHTML = "";

        let totalGiven = 0;
        let totalPending = 0;
        let totalReceived = 0;

        const filtered = getFilteredCredits();

        filtered.forEach(credit => {

            const originalIndex = credits.indexOf(credit);

            totalGiven += credit.amount;

            if (credit.status === "Pending")
                totalPending += credit.amount;
            else
                totalReceived += credit.amount;

            const li = document.createElement("li");
            li.classList.add("transaction-item");

            li.innerHTML = `
                <div class="transaction-info">
                    <span><strong>${credit.customer}</strong> (${credit.account}) - ${credit.notes || ""}</span>
                    <small>${credit.date} | ${credit.status}</small>
                </div>
                <div>
                    <span class="transaction-amount">
                        ${formatCurrency(credit.amount)}
                    </span>
                    ${
                        credit.status === "Pending"
                            ? `<button class="mark-paid" data-index="${originalIndex}">Mark Paid</button>`
                            : ""
                    }
                    <button class="delete-credit" data-index="${originalIndex}">
                        Delete
                    </button>
                </div>
            `;

            creditList.appendChild(li);
        });

        animateValue(totalCreditEl, 0, totalGiven);
        animateValue(pendingCreditEl, 0, totalPending);
        animateValue(receivedCreditEl, 0, totalReceived);
    }

    /* =============================
       ADD TRANSACTION
    ============================== */

    transactionForm.addEventListener("submit", function (e) {
        e.preventDefault();

        const account = document.getElementById("account").value;
        const type = document.getElementById("type").value;
        const amount = parseFloat(document.getElementById("amount").value);
        const date = document.getElementById("date").value;
        const notes = document.getElementById("notes").value;

        if (!account || !type || !amount || amount <= 0 || !date) {
            alert("Fill all required fields properly.");
            return;
        }

        transactions.push({ account, type, amount, date, notes });

        saveData();
        renderTransactions();

        transactionForm.reset();
        transactionModal.style.display = "none";
    });

    /* =============================
       ADD CREDIT
    ============================== */

    creditForm.addEventListener("submit", function (e) {
        e.preventDefault();

        const account = document.getElementById("creditAccount").value;
        const customer = document.getElementById("customerName").value;
        const amount = parseFloat(document.getElementById("creditAmount").value);
        const date = document.getElementById("creditDate").value;
        const notes = document.getElementById("creditNotes").value;

        if (!account || !customer || !amount || amount <= 0 || !date) {
            alert("Fill all required fields properly.");
            return;
        }

        credits.push({
            account,
            customer,
            amount,
            date,
            notes,
            status: "Pending"
        });

        saveData();
        renderCredits();

        creditForm.reset();
        creditModal.style.display = "none";
    });

    /* =============================
       DELETE & MARK PAID
    ============================== */

    document.addEventListener("click", function (e) {

        if (e.target.classList.contains("delete-transaction")) {
            const index = e.target.dataset.index;
            if (confirm("Delete this transaction?")) {
                transactions.splice(index, 1);
                saveData();
                renderTransactions();
            }
        }

        if (e.target.classList.contains("delete-credit")) {
            const index = e.target.dataset.index;
            if (confirm("Delete this credit entry?")) {
                credits.splice(index, 1);
                saveData();
                renderCredits();
            }
        }

        if (e.target.classList.contains("mark-paid")) {
            const index = e.target.dataset.index;
            const credit = credits[index];

            credit.status = "Paid";

            transactions.push({
                account: credit.account,
                type: "Income",
                amount: credit.amount,
                date: new Date().toISOString().split("T")[0],
                notes: `Credit received from ${credit.customer}`
            });

            saveData();
            renderCredits();
            renderTransactions();
        }
    });

    /* =============================
       EXPORT
    ============================== */

    exportBtn.addEventListener("click", function () {

        const filtered = getFilteredTransactions();

        if (filtered.length === 0) {
            alert("No transactions to export.");
            return;
        }

        let csv = "Account,Date,Type,Amount,Notes\n";

        filtered.forEach(t => {
            csv += `${t.account},${t.date},${t.type},${t.amount},"${t.notes || ""}"\n`;
        });

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "digica-transactions.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    /* =============================
       MODALS
    ============================== */

    openTransactionBtn.addEventListener("click", () => {
        transactionModal.style.display = "flex";
    });

    closeTransactionBtn.addEventListener("click", () => {
        transactionModal.style.display = "none";
    });

    openCreditBtn.addEventListener("click", () => {
        creditModal.style.display = "flex";
    });

    closeCreditBtn.addEventListener("click", () => {
        creditModal.style.display = "none";
    });

    window.addEventListener("click", function (e) {
        if (e.target === transactionModal) transactionModal.style.display = "none";
        if (e.target === creditModal) creditModal.style.display = "none";
    });

    accountFilter.addEventListener("change", function () {
        renderTransactions();
        renderCredits();
    });

    renderTransactions();
    renderCredits();

});
