// Get DOM elements
const form = document.getElementById("transactionForm");
const transactionList = document.getElementById("transactionList");
const totalIncomeEl = document.getElementById("totalIncome");
const totalExpenseEl = document.getElementById("totalExpense");
const netBalanceEl = document.getElementById("netBalance");

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

        const isIncomeType = transaction.type === "Income" || transaction.type === "Sale";

        if (isIncomeType) {
            totalIncome += transaction.amount;
        } else {
            totalExpense += transaction.amount;
        }

        li.innerHTML = `
            <div class="transaction-info">
                <span><strong>${transaction.type}</strong> - ${transaction.notes || "No notes"}</span>
                <small>${transaction.date}</small>
            </div>
            <div>
                <span class="transaction-amount">
                    ${isIncomeType ? "+" : "-"}${formatCurrency(transaction.amount)}
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

// Initial render on page load
renderTransactions();
