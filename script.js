// Get DOM elements
const form = document.getElementById("transactionForm");
const transactionList = document.getElementById("transactionList");
const totalIncomeEl = document.getElementById("totalIncome");
const totalExpenseEl = document.getElementById("totalExpense");
const netBalanceEl = document.getElementById("netBalance");
const exportBtn = document.getElementById("exportBtn");

// Load transactions from localStorage or initialize empty array
let transactions = JSON.parse(localStorage.getItem("transactions")) || [];

// Save transactions to localStorage
function saveTransactions() {
    localStorage.setItem("transactions", JSON.stringify(transactions));
}

// Format currency properly
function formatCurrency(amount) {
    return "₹ " + amount.toLocaleString("en-IN");
}

// Render all transactions to the UI
function renderTransactions() {
    transactionList.innerHTML = "";

    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach((transaction, index) => {
        const li = document.createElement("li");
        li.classList.add("transaction-item");

        const isIncomeType =
            transaction.type === "Income" || transaction.type === "Sale";

        if (isIncomeType) {
            totalIncome += transaction.amount;
        } else {
            totalExpense += transaction.amount;
        }

        li.innerHTML = `
            <div class="transaction-info">
                <span><strong>${transaction.type}</strong> - ${
            transaction.notes || "No notes"
        }</span>
                <small>${transaction.date}</small>
            </div>
            <div>
                <span class="transaction-amount">
                    ${isIncomeType ? "+" : "-"}${formatCurrency(
            transaction.amount
        )}
                </span>
                <button class="delete-btn" onclick="deleteTransaction(${index})">
                    Delete
                </button>
            </div>
        `;

        transactionList.appendChild(li);
    });

    const netBalance = totalIncome - totalExpense;

    // Update totals with formatting
    totalIncomeEl.textContent = formatCurrency(totalIncome);
    totalExpenseEl.textContent = formatCurrency(totalExpense);
    netBalanceEl.textContent = formatCurrency(netBalance);

    // Add color based on balance
    if (netBalance < 0) {
        netBalanceEl.classList.add("negative");
        netBalanceEl.classList.remove("positive");
    } else {
        netBalanceEl.classList.add("positive");
        netBalanceEl.classList.remove("negative");
    }
}

// Add new transaction
form.addEventListener("submit", function (e) {
    e.preventDefault();

    const type = document.getElementById("type").value;
    const amount = parseFloat(document.getElementById("amount").value);
    const date = document.getElementById("date").value;
    const notes = document.getElementById("notes").value;

    if (!amount || amount <= 0) {
        alert("Please enter a valid amount.");
        return;
    }

    const transaction = {
        type,
        amount,
        date,
        notes
    };

    transactions.push(transaction);

    saveTransactions();
    renderTransactions();
    form.reset();
});

// Delete transaction with confirmation
function deleteTransaction(index) {
    if (confirm("Are you sure you want to delete this transaction?")) {
        transactions.splice(index, 1);
        saveTransactions();
        renderTransactions();
    }
}

// ===============================
// EXPORT TO CSV FEATURE
// ===============================
exportBtn.addEventListener("click", function () {
    if (transactions.length === 0) {
        alert("No transactions to export.");
        return;
    }

    let csvContent = "Date,Type,Amount,Notes\n";

    transactions.forEach(transaction => {
        const row = [
            transaction.date,
            transaction.type,
            transaction.amount,
            `"${transaction.notes || ""}"`
        ];
        csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "cash-flow-data.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
});

// Initial render on page load
renderTransactions();
