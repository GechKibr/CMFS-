# Complaint Management and Feedback System (CMFS)

A comprehensive platform for managing complaints and collecting feedback across educational institutions. Built with Django REST Framework and React, CMFS enables seamless complaint resolution workflows with multi-level escalation, role-based access control, and feedback analytics.

## 🎯 Overview

CMFS is designed to streamline complaint handling and feedback collection in institutional settings. It provides:
- **Complainant Portal**: Submit and track complaints
- **Officer Portal**: Manage and resolve assigned complaints
- **Admin Portal**: System-wide oversight and configuration
- **Multi-language Support**: English and Amharic interface
- **Feedback System**: Create and analyze feedback surveys

## 👥 User Roles

### 1. **Complainant (User)**
- Submit new complaints with attachments
- Track complaint status in real-time
- Provide feedback and ratings
- Receive notifications on updates
- View complaint history

### 2. **Officer (Resolver)**
- View assigned complaints
- Update complaint status
- Provide responses and comments
- Manage feedback templates
- View performance analytics
- Escalate complaints when needed

### 3. **Administrator (Admin)**
- Manage institutions and categories
- Assign users and roles
- Configure resolver hierarchy
- Manage complaint categories
- System-wide monitoring
- Oversee all complaints

## 🏗️ Technology Stack

### Backend
- **Framework**: Django 6.0.1
- **API**: Django REST Framework 3.16.1
- **Authentication**: JWT (djangorestframework-simplejwt)
- **Database**: SQLite (Development)
- **Documentation**: drf-yasg (Swagger/OpenAPI)
- **ML/AI**: Hugging Face Transformers, Sentence Transformers

### Frontend
- **Framework**: React 18.3.1
- **Styling**: Tailwind CSS 3.4.15
- **Build Tool**: Vite 6.0.1
- **Routing**: React Router DOM 6.28.0
- **Animations**: React Beautiful DND

## 📁 Project Structure

```
CMFS-/
├── VBFinal/
│   ├── backend/                    # Django Backend
│   │   ├── accounts/               # User authentication & management
│   │   │   ├── models.py
│   │   │   ├── views.py
│   │   │   ├── serializers.py
│   │   │   └── migrations/
│   │   ├── complaints/             # Complaint workflow
│   │   │   ├── models.py
│   │   │   ├── views.py
│   │   │   ├── ai_service.py
│   │   │   └── migrations/
│   │   ├── feedback/               # Feedback & surveys
│   │   │   ├── models.py
│   │   │   └── views.py
│   │   ├── conf/                   # Project settings
│   │   │   ├── settings.py
│   │   │   ├── urls.py
│   │   │   └── wsgi.py
│   │   ├── manage.py
│   │   ├── db.sqlite3
│   │   └── requirements.txt
│   │
│   ├── frontend/                   # React Frontend
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── UserDashboard.jsx
│   │   │   │   ├── OfficerDashboard.jsx
│   │   │   │   ├── AdminDashboard.jsx
│   │   │   │   ├── Login.jsx
│   │   │   │   └── Register.jsx
│   │   │   ├── components/
│   │   │   │   ├── User/
│   │   │   │   ├── Officer/
│   │   │   │   ├── Admin/
│   │   │   │   ├── UI/
│   │   │   │   └── feedback/
│   │   │   ├── contexts/
│   │   │   ├── services/
│   │   │   └── App.jsx
│   │   ├── package.json
│   │   └── vite.config.js
│   │
│   └── vworld/                     # Python Virtual Environment
│
└── README.md
```

## 🚀 Installation & Setup

### Prerequisites
- Python 3.12+
- Node.js 18+
- npm or yarn
- Git

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd VBFinal/backend
   ```

2. **Activate virtual environment**
   ```bash
   source ../../vworld/bin/activate  # Linux/Mac
   # or
   ..\..\vworld\Scripts\activate     # Windows
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run migrations**
   ```bash
   python manage.py migrate
   ```

5. **Create superuser (Admin)**
   ```bash
   python manage.py createsuperuser
   ```

6. **Start development server**
   ```bash
   python manage.py runserver
   ```
   Backend will be available at `http://localhost:8000`

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd VBFinal/frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```
   Frontend will be available at `http://localhost:5173`

## 📚 API Documentation

### Authentication Endpoints
```
POST   /api/users/login/           - User login
POST   /api/users/register/        - Create new account
GET    /api/users/me/              - Get current user profile
POST   /api/users/logout/          - Logout
```

### Complaint Endpoints
```
GET    /api/complaints/            - List all complaints (filtered by role)
POST   /api/complaints/            - Submit new complaint
GET    /api/complaints/{id}/       - Get complaint details
PUT    /api/complaints/{id}/       - Update complaint
```

### Category Endpoints
```
GET    /api/categories/            - List complaint categories
GET    /api/categories/by-language/ - Get categories in specific language
```

### Feedback Endpoints
```
GET    /api/feedback/templates/    - List feedback templates
POST   /api/feedback/templates/    - Create new template
POST   /api/feedback/responses/    - Submit feedback response
```

### Admin Endpoints
```
GET    /api/institutions/          - Manage institutions
GET    /api/users/                 - Manage users
POST   /api/category-resolvers/    - Assign resolvers
```

**Full API documentation available at**: `http://localhost:8000/api/docs/` (Swagger)

## 🔄 Complaint Workflow

```
1. Complainant submits complaint
        ↓
2. System assigns to resolver (Officer)
        ↓
3. Officer updates status (In Progress)
        ↓
4. Officer provides response/resolution
   ├─→ If resolved: Status = Resolved
   └─→ If urgent/complex: Escalate to higher level
        ↓
5. Complainant reviews resolution
        ↓
6. Provides feedback (Optional)
        ↓
7. Complaint closed
```

## 🌍 Multi-Language Support

The system supports:
- **English** (Default)
- **Amharic** (አማርኛ)

Switch languages in the UI using the language toggle button.

## 🔐 Security Features

- JWT-based authentication
- Role-based access control (RBAC)
- Email verification for new accounts
- Password reset functionality
- Email notifications for important events
- Request logging and monitoring

## 📊 Features

### For Complainants
✅ Easy complaint submission with attachments  
✅ Real-time status tracking  
✅ Notification system for updates  
✅ Feedback form submission  
✅ Complaint history  

### For Officers
✅ Complaint assignment dashboard  
✅ Status update workflow  
✅ Response and comment system  
✅ Feedback template management  
✅ Performance analytics  
✅ Escalation management  

### For Administrators
✅ User and role management  
✅ Institution configuration  
✅ Category management  
✅ Resolver hierarchy setup  
✅ System monitoring  
✅ Feedback template oversight  

## 🧪 Testing

### Run Backend Tests
```bash
cd VBFinal/backend
python manage.py test
```

### Run Frontend Tests
```bash
cd VBFinal/frontend
npm run test
```

## 📝 Environment Configuration

Create a `.env` file in the backend directory:
```env
DEBUG=True
SECRET_KEY=your-secret-key
DATABASE_URL=sqlite:///db.sqlite3
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-password
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📋 Development Roadmap

- [ ] Docker containerization
- [ ] Advanced analytics dashboard
- [ ] AI-powered complaint classification
- [ ] Mobile app (React Native)
- [ ] PDF report generation
- [ ] Automated escalation alerts
- [ ] Integration with external systems
- [ ] Improved accessibility (WCAG 2.1)

## 🐛 Known Issues & Improvements Needed

| Priority | Issue | Status |
|----------|-------|--------|
| 🔴 High | Implement proper permission checks (currently AllowAny) | TODO |
| 🔴 High | Add pagination to list endpoints | TODO |
| 🟡 Medium | Enhance error handling and validation | TODO |
| 🟡 Medium | Add comprehensive unit tests | TODO |
| 🟡 Medium | Implement rate limiting | TODO |
| 🟢 Low | Create Docker setup | TODO |

## 💬 Support

For issues, questions, or suggestions:
1. Open an issue on GitHub
2. Check existing documentation
3. Review API documentation at `/api/docs/`

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👨‍💻 Project Team

**CMFS** - Complaint Management and Feedback System
Version 1.0.0

---

**Last Updated**: January 30, 2026