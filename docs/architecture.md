# Architecture Overview

## System Design

FinTrack follows a modular architecture with clear separation of concerns:

### Core Layers

1. **Presentation Layer**
   - Located in `app/(root)/(tabs)/`
   - Handles all UI components and user interactions
   - Implements responsive design patterns
   - Manages navigation and routing

2. **Business Logic Layer**
   - Located in `app/(root)/services/`
   - Implements core business rules
   - Handles data processing and transformations
   - Manages state and business logic

3. **Data Access Layer**
   - Located in `app/(root)/firebase/`
   - Handles data persistence
   - Manages Firebase integration
   - Implements data models and types

4. **Context Layer**
   - Located in `app/(root)/context/`
   - Manages global application state
   - Handles authentication state
   - Manages theme and preferences

## Technical Stack

### Frontend
- React Native with Expo
- TypeScript for type safety
- NativeWind for styling
- Expo Router for navigation

### Backend
- Firebase Authentication
- Firestore Database
- Firebase Storage

### State Management
- React Context API
- Custom hooks for data management
- AsyncStorage for local persistence

## Directory Structure

```
app/
├── (root)/
│   ├── (tabs)/           # Main application screens
│   ├── services/         # Business logic services
│   ├── firebase/         # Firebase integration
│   ├── context/          # Global state management
│   └── charts/           # Data visualization components
├── assets/               # Static assets
└── constants/            # Application constants
```

## Key Components

### Services
- `accountService.ts`: Manages financial accounts
- `transactionService.ts`: Handles transaction processing
- `budgetService.ts`: Manages budget calculations
- `categoryService.ts`: Handles category management
- `dailyAggregationService.ts`: Processes daily data
- `preloadService.ts`: Manages data preloading
- `userService.ts`: Handles user data

### Firebase Integration
- `firebaseConfig.ts`: Firebase configuration
- `types.ts`: TypeScript type definitions
- `services.ts`: Firebase service implementations
- `firestore.ts`: Firestore database operations

### Context Providers
- `AuthContext.tsx`: Authentication state
- `ThemeContext.tsx`: Theme management

### Charts
- `SpendingOverTimeChart.tsx`: Time-based spending visualization
- `AverageSpendingChart.tsx`: Average spending analysis
- `CategoryBreakdownChart.tsx`: Category distribution

## Design Patterns

1. **Service Pattern**
   - Encapsulates business logic
   - Provides clear interfaces
   - Handles data transformations

2. **Context Pattern**
   - Manages global state
   - Provides shared functionality
   - Handles cross-cutting concerns

3. **Repository Pattern**
   - Abstracts data access
   - Provides consistent data operations
   - Handles data persistence

4. **Factory Pattern**
   - Creates complex objects
   - Manages object lifecycle
   - Provides consistent interfaces 