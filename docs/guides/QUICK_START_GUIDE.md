# SommOS Quick Start Guide

**Your Docker deployment is now running!** 🍷

---

## 🌐 Access SommOS

**Frontend URL**: <http://localhost>

The application should have automatically opened in your browser. If not, click the link above or navigate to `http://localhost` in your web browser.

---

## 🔐 Login Credentials

### Administrator Account

- **Email**: `admin@sommos.local`
- **Password**: `admin123`
- **Role**: Full administrative access
- **Capabilities**:
  - Manage all wines and inventory
  - Create/edit users
  - Configure system settings
  - Access all features

### Crew Member Account

- **Email**: `crew@sommos.local`
- **Password**: `crew123`
- **Role**: Operational access
- **Capabilities**:
  - Manage wine inventory
  - Record consumption and stock movements
  - Create wine pairings
  - Access procurement recommendations
  - View analytics

### Guest Account (Basic)

- **Email**: `guest@sommos.local`
- **Password**: `guest123`
- **Role**: Read-only access
- **Capabilities**:
  - Browse wine collection
  - View wine details
  - Search wines
  - Limited features

---

## 🎫 Guest Event Codes (No Login Required)

Perfect for wine tasting events or showing the app to others!

### Event Code 1 (No PIN)

- **Code**: `YACHT2024`
- **PIN**: None
- **Access**: Click "Guest Access" tab on login page
- **Duration**: Read-only access to wine collection

### Event Code 2 (With PIN)

- **Code**: `GUEST2024`
- **PIN**: `123456`
- **Access**: Click "Guest Access" tab on login page
- **Duration**: Read-only access to wine collection

---

## 📊 What's Already Loaded

Your database comes pre-populated with realistic data:

- **2,982 wines** from various regions
- **1,050 vintages** with quality scores
- **1,934 bottles** in inventory
- Multiple storage locations
- Wine pairing data
- Weather intelligence data

---

## 🚀 Try These Features

### 1. Browse Wine Collection

- Navigate to "Wines" or "Inventory"
- Use search and filters to find specific wines
- Click on any wine to see detailed information

### 2. Wine Pairing Recommendations

- Go to "Pairing" section
- Enter a dish name (e.g., "Grilled Salmon")
- Get AI-powered wine recommendations

### 3. Inventory Management (Admin/Crew only)

- Track wine consumption
- Move bottles between locations
- Reserve wines for events
- View transaction history

### 4. Procurement Intelligence (Admin/Crew only)

- Get buying recommendations
- Analyze procurement opportunities
- View supplier information

### 5. Vintage Analysis

- Check weather impact on specific vintages
- View quality scores and aging potential
- Get procurement timing recommendations

---

## 🎨 PWA Features

### Install as App

1. Look for the "Install" button in your browser (usually in the address bar)
2. Click "Install" to add SommOS to your dock/taskbar
3. Launch it like a native app!

### Offline Mode

- The app works offline after initial load
- Browse wines without internet
- Changes sync when connection is restored

---

## 🔧 Docker Management

### View Application Logs

```bash
docker-compose -f deployment/production.yml logs -f
```

### Check Container Status

```bash
docker-compose -f deployment/production.yml ps
```

### Restart Containers

```bash
docker-compose -f deployment/production.yml restart
```

### Stop SommOS

```bash
docker-compose -f deployment/production.yml down
```

### Start SommOS Again

```bash
docker-compose -f deployment/production.yml up -d
```

---

## 📍 Important URLs

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | <http://localhost> | Main PWA interface |
| **API** | <http://localhost/api> | REST API endpoints |
| **Health Check** | <http://localhost/api/system/health> | System status |
| **API Docs** | <http://localhost/docs> | Interactive API documentation |
| **WebSocket** | ws://localhost/api/ws | Real-time updates |

---

## 🎯 Quick Tips

1. **First Time Login**: Use the admin account to explore all features
2. **Guest Demo**: Use event code `YACHT2024` to show read-only access
3. **Mobile**: The PWA works great on mobile browsers too!
4. **Offline**: Try turning off WiFi after loading - it still works!
5. **Search**: Use the search bar to quickly find wines by name, region, or type

---

## 🐛 Troubleshooting

### Can't Connect?

```bash
# Check if containers are running
docker ps | grep sommos

# View logs for errors
docker logs sommos-production --tail 50
```

### Need to Reset?

```bash
# Stop containers
docker-compose -f deployment/production.yml down

# Start fresh
docker-compose -f deployment/production.yml up -d
```

### Port Already in Use?

If port 80 is already taken:

1. Stop other services using port 80
2. Or access directly via port 3000: <http://localhost:3000>

---

## 📚 Learn More

- **Full Documentation**: See `README.md`
- **Docker Testing**: See `DOCKER_TEST_REPORT.md`
- **Docker Updates**: See `DOCKER_UPDATE_SUMMARY.md`
- **Guest Access Guide**: See `docs/GUEST_ACCESS.md`

---

## 🍷 Enjoy Exploring SommOS

You're all set! Start by logging in with the admin account and exploring the wine collection. Try creating a wine pairing, checking vintage intelligence, or browsing the inventory.

**Questions?** Check the logs or review the documentation in the `docs/` folder.

**Have fun managing your virtual yacht wine collection!** 🚢🍷
