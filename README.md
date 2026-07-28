# Qatar Panel Tracker

Advanced panel management and tracking system built with React, TypeScript, and Supabase.

## Features

- 🏢 Building and facade management
- 📊 Panel tracking and status monitoring
- 👥 User role-based access control (RBAC)
- 📱 QR code generation for panels
- 📈 Project management and analytics
- 🔄 Bulk import capabilities
- 📱 Responsive design with Tailwind CSS

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **UI Components**: Radix UI, Lucide React
- **Routing**: React Router DOM
- **Charts**: Recharts
- **QR Codes**: qrcode.react

## Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```

## Deployment on Vercel

This application is configured for easy deployment on Vercel:

1. **Connect to Vercel**: 
   - Install Vercel CLI: `npm i -g vercel`
   - Run `vercel` in the project directory
   - Follow the prompts to connect your GitHub repository

2. **Environment Variables** (if needed):
   - The Supabase configuration is already hardcoded in `src/lib/supabase.js`
   - For production, consider moving these to environment variables

3. **Automatic Deployment**:
   - Vercel will automatically detect this as a Create React App
   - Build command: `npm run build`
   - Output directory: `build`

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components (shadcn/ui style)
│   └── project-details/ # Project-specific components
├── contexts/           # React contexts (Auth, Toast)
├── lib/               # External library configurations
├── pages/             # Page components
├── utils/             # Utility functions
└── styles/            # Global styles
```

## Database Schema

The application uses Supabase with the following main entities:
- Users (with role-based permissions)
- Projects
- Buildings
- Facades
- Panel Groups
- Panels
- Status Histories

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

Private project - All rights reserved
