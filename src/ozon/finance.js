export function aggregateOzonMonthlyFinance(operations = []) {
  const months = new Map();
  for (const operation of operations) {
    const month = String(operation.operation_date || operation.operationDate || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const current = months.get(month) || { month, sales: 0, profit: 0, logisticsCost: 0 };
    current.sales += number(operation.accruals_for_sale);
    current.profit += number(operation.amount);
    current.logisticsCost += logisticsCost(operation);
    months.set(month, current);
  }
  return [...months.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((item) => ({
      ...item,
      sales: roundMoney(item.sales),
      profit: roundMoney(item.profit),
      logisticsCost: roundMoney(item.logisticsCost),
      logisticsShareOfSales: item.sales ? roundRatio(item.logisticsCost / item.sales) : 0,
    }));
}

export function extractFinanceOperations(response) {
  return response?.result?.operations || response?.operations || [];
}

function logisticsCost(operation) {
  const services = Array.isArray(operation.services) ? operation.services : [];
  return services.reduce((sum, service) => {
    const name = String(service.name || service.service_name || "").toLowerCase();
    if (name.includes("logistic") || name.includes("delivery") || name.includes("достав") || name.includes("логист")) {
      return sum + Math.abs(number(service.price));
    }
    return sum;
  }, 0);
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function roundRatio(value) {
  return Math.round(value * 10000) / 10000;
}
