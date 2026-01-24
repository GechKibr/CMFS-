# University Complaint Management System

A responsive React application built with TailwindCSS for managing university complaints with role-based dashboards for Admin, Officer, and User roles.

## Features

### 🔐 Authentication
- Role-based login system
- Automatic redirection based on user role
- Protected routes with authorization

### 👨‍💼 Admin Dashboard
- **Overview**: System statistics and metrics
- **Institutions**: Manage university institutions and domains
- **Categories**: Create and assign complaint categories to officers
- **Users**: User management with role assignments
- **Complaints**: View and manage all complaints
- **AI Settings**: Configure automatic categorization and officer assignment
- **System Settings**: Global configuration and audit logs

### 👮‍♂️ Officer Dashboard
- **Assigned Complaints**: View and manage assigned complaints
- **Actions**: Update status, add comments, escalate complaints
- **History**: Track resolved complaints
- **Notifications**: Real-time alerts for assignments and escalations

### 👤 User Dashboard
- **Overview**: Personal complaint statistics
- **Submit Complaint**: Easy complaint submission form
- **My Complaints**: Track complaint status and progress
- **Notifications**: Updates on complaint resolution

## Color Palette

The application uses a minimal, performance-optimized color palette:
- **Primary**: `#1D4ED8` (blue-700) - Primary actions and navigation
- **Neutral**: `#374151` (gray-700) - Text and neutral elements
- **Success**: `#10B981` (green-500) - Success states and resolved items
- **Error**: `#EF4444` (red-500) - Urgent items and errors
- **Warning**: `#F59E0B` (yellow-500) - Warnings and pending states
- **Backgrounds**: White and light gray for clean layouts

## Tech Stack

- **React 18** - Modern React with hooks
- **React Router DOM** - Client-side routing
- **TailwindCSS** - Utility-first CSS framework
- **Vite** - Fast build tool and dev server

## Getting Started

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Test Accounts

Use these email addresses to test different roles:
- **Admin**: `admin@university.edu`
- **Officer**: `officer@university.edu` 
- **User**: `user@university.edu`

Password can be anything for demo purposes.

## Project Structure

```
src/
├── components/
│   └── Navbar.jsx          # Navigation component
├── contexts/
│   └── AuthContext.jsx     # Authentication state management
├── pages/
│   ├── Login.jsx           # Login page
│   ├── AdminDashboard.jsx  # Admin dashboard
│   ├── OfficerDashboard.jsx # Officer dashboard
│   └── UserDashboard.jsx   # User dashboard
├── App.jsx                 # Main app component with routing
├── main.jsx               # App entry point
└── index.css              # TailwindCSS imports
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Responsive Design

The application is fully responsive and works on:
- **Desktop**: Full feature set with sidebar navigation
- **Tablet**: Adapted layouts with collapsible navigation
- **Mobile**: Touch-friendly interface with mobile-optimized forms

## Key Components

### Authentication Flow
1. User enters credentials on login page
2. System determines role based on email domain
3. User is redirected to appropriate dashboard
4. Protected routes ensure proper authorization

### Dashboard Features
- **Tabbed Navigation**: Clean organization of features
- **Data Tables**: Responsive tables with sorting and filtering
- **Status Badges**: Color-coded status indicators
- **Modal Forms**: Inline editing and creation
- **Real-time Updates**: Live notifications and status changes

## Customization

### Adding New Roles
1. Update `AuthContext.jsx` to handle new role
2. Create new dashboard component
3. Add route in `App.jsx`
4. Update `Navbar.jsx` with role-specific links

### Styling Changes
- Modify `tailwind.config.js` for color scheme changes
- Update component classes for layout modifications
- Use TailwindCSS utilities for consistent styling

## Production Deployment

1. Build the application:
```bash
npm run build
```

2. Deploy the `dist` folder to your web server

3. Configure your server to serve `index.html` for all routes (SPA routing)

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.
