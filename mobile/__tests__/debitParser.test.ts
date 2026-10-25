import { parseFinancialMessage } from "../services/debitParser";

describe("DebitParser", () => {
  test("parses standard UPI debit message", () => {
    const msg = "Dear SBI User, your A/c ending 4589 debited by Rs 450.00 on 24-Sep-26 by UPI to Swiggy ref 987654321012";
    const res = parseFinancialMessage(msg);
    expect(res.isFinancial).toBe(true);
    expect(res.direction).toBe("DEBIT");
    expect(res.amount).toBe(450);
    expect(res.currency).toBe("INR");
    expect(res.merchant).toBe("Swiggy");
    expect(res.accountTail).toBe("4589");
    expect(res.referenceNumber).toBe("987654321012");
  });

  test("parses HDFC card purchase debit message", () => {
    const msg = "Alert: You have spent INR 1,250.50 on HDFC Bank Card ending 8812 at AMAZON INDIA on 2026-09-24:14:20:10. Avl bal: INR 45,000.";
    const res = parseFinancialMessage(msg);
    expect(res.isFinancial).toBe(true);
    expect(res.direction).toBe("DEBIT");
    expect(res.amount).toBe(1250.50);
    expect(res.currency).toBe("INR");
    expect(res.merchant).toBe("AMAZON INDIA");
    expect(res.accountTail).toBe("8812");
  });

  test("parses ICICI bank notification with rupee symbol and balance", () => {
    const msg = "ICICI Bank Alert: ₹850.00 debited from A/c XX5678 on 15-Oct-26 towards Zomato. Avbl Bal: ₹12,450.00.";
    const res = parseFinancialMessage(msg);
    expect(res.isFinancial).toBe(true);
    expect(res.direction).toBe("DEBIT");
    expect(res.amount).toBe(850);
    expect(res.currency).toBe("INR");
    expect(res.merchant).toBe("Zomato");
    expect(res.accountTail).toBe("5678");
  });

  test("parses international USD transaction", () => {
    const msg = "Chase Alert: Your card ending 1024 was charged $42.50 at Target Store on 14-Oct-2026.";
    const res = parseFinancialMessage(msg);
    expect(res.isFinancial).toBe(true);
    expect(res.direction).toBe("DEBIT");
    expect(res.amount).toBe(42.50);
    expect(res.currency).toBe("USD");
    expect(res.merchant).toBe("Target Store");
    expect(res.accountTail).toBe("1024");
  });

  test("parses European EUR subscription payment", () => {
    const msg = "N26: €14.99 paid to Netflix via Direct Debit on 12-Oct-2026.";
    const res = parseFinancialMessage(msg);
    expect(res.isFinancial).toBe(true);
    expect(res.direction).toBe("DEBIT");
    expect(res.amount).toBe(14.99);
    expect(res.currency).toBe("EUR");
    expect(res.merchant).toBe("Netflix");
  });

  test("parses credit / salary alert", () => {
    const msg = "Your a/c no. xx1234 is credited by Rs. 50,000.00 on 24-Sep-26 by transfer from ACME Corp. Ref 11223344.";
    const res = parseFinancialMessage(msg);
    expect(res.isFinancial).toBe(true);
    expect(res.direction).toBe("CREDIT");
    expect(res.amount).toBe(50000);
    expect(res.accountTail).toBe("1234");
    expect(res.referenceNumber).toBe("11223344");
  });

  test("ignores non-financial OTP or conversational message", () => {
    const msg = "Your OTP for login is 482910. Please do not share it with anyone.";
    const res = parseFinancialMessage(msg);
    expect(res.isFinancial).toBe(false);
    expect(res.direction).toBe("UNKNOWN");
    expect(res.amount).toBeNull();
  });

  test("rejects purchase OTP as non-executed transaction", () => {
    const msg = "Dear SBI User, OTP for your purchase of Rs 450.00 at Swiggy is 987654. Do not share with anyone.";
    const res = parseFinancialMessage(msg);
    expect(res.isFinancial).toBe(false);
    expect(res.direction).toBe("UNKNOWN");
    expect(res.amount).toBeNull();
  });

  test("rejects declined or failed transaction", () => {
    const msg = "Alert: Txn of Rs 1,200 at Shell Petrol was declined due to card block.";
    const res = parseFinancialMessage(msg);
    expect(res.isFinancial).toBe(false);
    expect(res.direction).toBe("UNKNOWN");
    expect(res.amount).toBeNull();
  });

  test("rejects credit card bill due reminder", () => {
    const msg = "Your credit card bill of Rs 5,400 is due on 28-Oct. Pay now to avoid late charges.";
    const res = parseFinancialMessage(msg);
    expect(res.isFinancial).toBe(false);
    expect(res.direction).toBe("UNKNOWN");
    expect(res.amount).toBeNull();
  });

  test("rejects payment request or mandate creation", () => {
    const msg = "User Rahul has requested payment of Rs 500 via UPI. Click to approve.";
    const res = parseFinancialMessage(msg);
    expect(res.isFinancial).toBe(false);
    expect(res.direction).toBe("UNKNOWN");
    expect(res.amount).toBeNull();
  });

  test("parses Google Pay UPI push notification", () => {
    const msg = "Paid ₹150.00 to Chai Point using HDFC Bank A/c xx1234";
    const res = parseFinancialMessage(msg);
    expect(res.isFinancial).toBe(true);
    expect(res.direction).toBe("DEBIT");
    expect(res.amount).toBe(150);
    expect(res.merchant).toBe("Chai Point");
    expect(res.accountTail).toBe("1234");
  });

  test("parses PhonePe UPI push notification", () => {
    const msg = "Paid ₹340 to Fresh Fruits successfully";
    const res = parseFinancialMessage(msg);
    expect(res.isFinancial).toBe(true);
    expect(res.direction).toBe("DEBIT");
    expect(res.amount).toBe(340);
    expect(res.merchant).toBe("Fresh Fruits");
  });

  test("parses CRED UPI notification", () => {
    const msg = "Paid ₹1,200 for Swiggy with CRED";
    const res = parseFinancialMessage(msg);
    expect(res.isFinancial).toBe(true);
    expect(res.direction).toBe("DEBIT");
    expect(res.amount).toBe(1200);
    expect(res.merchant).toBe("Swiggy");
  });
});
