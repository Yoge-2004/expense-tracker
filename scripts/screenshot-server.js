const http = require('http');
const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const MOBILE_DIR = path.join(__dirname, '..', 'mobile', 'dist');

// Realistic Simulated Financial Dataset
const mockUser = {
  id: 1,
  name: 'Yogeswaran',
  username: 'yoge',
  email: 'yoge@example.com',
  currency: 'INR',
  hasSecurityPin: true,
  emailVerificationEnabled: true,
  createdAt: '2026-01-10T00:00:00'
};

const mockCategoriesGlobal = [
  { id: 1, name: 'Food & Dining' },
  { id: 2, name: 'Housing & Rent' },
  { id: 3, name: 'Transportation' },
  { id: 4, name: 'Entertainment' },
  { id: 5, name: 'Shopping' },
  { id: 6, name: 'Utilities' },
  { id: 7, name: 'Health & Fitness' },
  { id: 8, name: 'Subscriptions' },
  { id: 9, name: 'Investments' }
];

const mockCategoriesUser = [
  { id: 10, name: 'Tech & Gadgets', user: { id: 1 } },
  { id: 11, name: 'Travel & Trips', user: { id: 1 } }
];

const allCategories = [...mockCategoriesGlobal, ...mockCategoriesUser];

const mockExpenses = [
  { id: 101, amount: 24000.00, description: 'Luxury Apartment Rent & Maintenance', date: '2026-09-01', category: { id: 2, name: 'Housing & Rent' }, recurring: true, recurringFrequency: 'MONTHLY', user: { id: 1 } },
  { id: 102, amount: 12500.00, description: 'Cult.fit Pro Gym Membership Renewal', date: '2026-09-02', category: { id: 7, name: 'Health & Fitness' }, recurring: true, recurringFrequency: 'YEARLY', user: { id: 1 } },
  { id: 103, amount: 3650.00, description: 'Whole Foods Fresh Market & Pantry', date: '2026-09-03', category: { id: 1, name: 'Food & Dining' }, recurring: false, user: { id: 1 } },
  { id: 104, amount: 2850.00, description: 'Fiber Broadband & Electricity Bill', date: '2026-09-03', category: { id: 6, name: 'Utilities' }, recurring: true, recurringFrequency: 'MONTHLY', user: { id: 1 } },
  { id: 105, amount: 4990.00, description: 'Uniqlo Autumn Wardrobe Collection', date: '2026-09-04', category: { id: 5, name: 'Shopping' }, recurring: false, user: { id: 1 } },
  { id: 106, amount: 2450.00, description: 'Shell V-Power Premium Fuel', date: '2026-09-04', category: { id: 3, name: 'Transportation' }, recurring: false, user: { id: 1 } },
  { id: 107, amount: 15000.00, description: 'Nifty 50 Index Fund Monthly SIP', date: '2026-09-05', category: { id: 9, name: 'Investments' }, recurring: true, recurringFrequency: 'MONTHLY', user: { id: 1 } },
  { id: 108, amount: 1850.00, description: 'Artisan Bistro Dinner with Friends', date: '2026-09-05', category: { id: 1, name: 'Food & Dining' }, recurring: false, user: { id: 1 } },
  { id: 109, amount: 890.00, description: 'Uber Premier City Ride', date: '2026-09-06', category: { id: 3, name: 'Transportation' }, recurring: false, user: { id: 1 } },
  { id: 110, amount: 1499.00, description: 'Amazon Prime Annual Plan', date: '2026-09-06', category: { id: 8, name: 'Subscriptions' }, recurring: true, recurringFrequency: 'YEARLY', user: { id: 1 } },
  { id: 111, amount: 649.00, description: 'Netflix 4K Ultra HD Premium', date: '2026-09-06', category: { id: 8, name: 'Subscriptions' }, recurring: true, recurringFrequency: 'MONTHLY', user: { id: 1 } },
  { id: 112, amount: 749.00, description: 'Apple One Cloud & Music Bundle', date: '2026-09-07', category: { id: 8, name: 'Subscriptions' }, recurring: true, recurringFrequency: 'MONTHLY', user: { id: 1 } },
  { id: 113, amount: 830.00, description: 'GitHub Copilot Enterprise License', date: '2026-09-07', category: { id: 8, name: 'Subscriptions' }, recurring: true, recurringFrequency: 'MONTHLY', user: { id: 1 } },
  { id: 114, amount: 1450.00, description: 'Swiggy Gourmet Dinner Platter', date: '2026-09-07', category: { id: 1, name: 'Food & Dining' }, recurring: false, user: { id: 1 } },
  { id: 115, amount: 480.00, description: 'Third Wave Coffee Roasters Brew', date: '2026-09-08', category: { id: 1, name: 'Food & Dining' }, recurring: false, user: { id: 1 } },
  { id: 116, amount: 2200.00, description: 'Keychron Mechanical Keyboard Switches', date: '2026-09-08', category: { id: 10, name: 'Tech & Gadgets' }, recurring: false, user: { id: 1 } }
];

const mockIncomes = [
  { id: 201, amount: 95000.00, source: 'Lead Software Architect Salary', date: '2026-09-01', user: { id: 1 } },
  { id: 202, amount: 28500.00, source: 'Cloud Infrastructure Consulting', date: '2026-09-04', user: { id: 1 } },
  { id: 203, amount: 4200.00, source: 'Dividend Yield & High-Yield Interest', date: '2026-09-06', user: { id: 1 } }
];

const mockBudgets = [
  { category: 'Housing & Rent', limit: 25000.00, spent: 24000.00, percentage: 96.0, remaining: 1000.00 },
  { category: 'Health & Fitness', limit: 15000.00, spent: 12500.00, percentage: 83.3, remaining: 2500.00 },
  { category: 'Food & Dining', limit: 15000.00, spent: 7430.00, percentage: 49.5, remaining: 7570.00 },
  { category: 'Shopping', limit: 8000.00, spent: 4990.00, percentage: 62.4, remaining: 3010.00 },
  { category: 'Transportation', limit: 5000.00, spent: 3340.00, percentage: 66.8, remaining: 1660.00 },
  { category: 'Subscriptions', limit: 4500.00, spent: 3727.00, percentage: 82.8, remaining: 773.00 }
];

const mockSavingsGoals = [
  { id: 301, name: 'Emergency Reserve 2026', targetAmount: 250000.00, currentAmount: 185000.00, deadline: '2026-12-31', user: { id: 1 } },
  { id: 302, name: 'MacBook Pro M3 Max Workstation', targetAmount: 180000.00, currentAmount: 145000.00, deadline: '2026-10-15', user: { id: 1 } },
  { id: 303, name: 'Tokyo Autumn Explorer Trip', targetAmount: 200000.00, currentAmount: 85000.00, deadline: '2026-11-20', user: { id: 1 } }
];

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2'
};

function serveStatic(baseDir, req, res, defaultFile = 'index.html') {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/' + defaultFile;
  
  let filePath = path.join(baseDir, reqPath);
  if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
    filePath = filePath + '.html';
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
  } else {
    // SPA Fallback: serve index.html for client-side routes
    const fallbackPath = path.join(baseDir, defaultFile);
    if (fs.existsSync(fallbackPath)) {
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(fallbackPath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found: ' + reqPath);
    }
  }
}

function handleApi(req, res) {
  const url = req.url.split('?')[0];
  const method = req.method;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health
  if (url === '/api/health' || url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'UP', database: 'UP' }));
    return;
  }

  // Auth Login
  if (url === '/api/auth/login') {
    res.writeHead(200);
    res.end(JSON.stringify({
      token: 'mock-jwt-yoge-session-token',
      userId: 1,
      userName: 'Yogeswaran',
      name: 'Yogeswaran',
      email: 'yoge@example.com',
      currency: 'INR',
      hasSecurityPin: true,
      emailVerificationEnabled: true
    }));
    return;
  }

  // Categories
  if (url === '/api/categories/global') {
    res.writeHead(200);
    res.end(JSON.stringify(mockCategoriesGlobal));
    return;
  }
  if (url.startsWith('/api/categories/user/')) {
    res.writeHead(200);
    res.end(JSON.stringify(mockCategoriesUser));
    return;
  }

  // Expenses
  if (url.startsWith('/api/expenses/user/')) {
    res.writeHead(200);
    res.end(JSON.stringify(mockExpenses));
    return;
  }
  if (url.startsWith('/api/expenses/budget/status/user/')) {
    res.writeHead(200);
    res.end(JSON.stringify(mockBudgets));
    return;
  }
  if (url.startsWith('/api/expenses/recurring/user/')) {
    const recurring = mockExpenses.filter(e => e.recurring);
    res.writeHead(200);
    res.end(JSON.stringify(recurring));
    return;
  }

  // Incomes
  if (url.startsWith('/api/incomes/user/')) {
    res.writeHead(200);
    res.end(JSON.stringify(mockIncomes));
    return;
  }

  // Savings Goals
  if (url.startsWith('/api/savings/goals/user/')) {
    res.writeHead(200);
    res.end(JSON.stringify(mockSavingsGoals));
    return;
  }

  // User Profile
  if (url === '/api/user/profile' || url.startsWith('/api/users/')) {
    res.writeHead(200);
    res.end(JSON.stringify(mockUser));
    return;
  }

  // Default fallback
  res.writeHead(200);
  res.end(JSON.stringify({ status: 'ok', data: [] }));
}

// 1. Web Frontend & API Server on Port 8080
const webServer = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    handleApi(req, res);
  } else {
    serveStatic(FRONTEND_DIR, req, res, 'dashboard.html');
  }
});

webServer.listen(8080, '0.0.0.0', () => {
  console.log('[WebServer] Serving frontend and simulated API on http://localhost:8080');
});

// 2. Mobile Web App Server on Port 8081
const mobileServer = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    handleApi(req, res);
  } else {
    serveStatic(MOBILE_DIR, req, res, 'index.html');
  }
});

mobileServer.listen(8081, '0.0.0.0', () => {
  console.log('[MobileServer] Serving mobile web on http://localhost:8081');
});
