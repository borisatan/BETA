# Core Services Documentation

## Account Management

### AccountService
Located in `app/(root)/services/accountService.ts`

#### Key Features
- Account creation and management
- Balance tracking
- Account type handling
- Transaction history

#### Main Methods
```typescript
class AccountService {
  static createAccount(account: Omit<Account, 'id'>): Promise<string>
  static getAccounts(userId: string): Promise<Account[]>
  static updateAccountBalance(accountId: string, amount: number): Promise<void>
  static deleteAccount(accountId: string): Promise<void>
}
```

## Transaction Processing

### TransactionService
Located in `app/(root)/services/transactionService.ts`

#### Key Features
- Transaction creation and management
- Category assignment
- Amount validation
- Date handling

#### Main Methods
```typescript
class TransactionService {
  static createTransaction(transaction: Omit<Transaction, 'id'>): Promise<string>
  static getTransactions(userId: string, filters?: TransactionFilters): Promise<Transaction[]>
  static updateTransaction(transactionId: string, updates: Partial<Transaction>): Promise<void>
  static deleteTransaction(transactionId: string): Promise<void>
}
```

## Budget Management

### BudgetService
Located in `app/(root)/services/budgetService.ts`

#### Key Features
- Budget creation and tracking
- Category-based budgeting
- Progress monitoring
- Alert system

#### Main Methods
```typescript
class BudgetService {
  static createBudget(budget: Omit<Budget, 'id'>): Promise<string>
  static getBudgets(userId: string): Promise<Budget[]>
  static updateBudgetProgress(budgetId: string, amount: number): Promise<void>
  static deleteBudget(budgetId: string): Promise<void>
}
```

## Category System

### CategoryService
Located in `app/(root)/services/categoryService.ts`

#### Key Features
- Category hierarchy management
- Custom category creation
- Icon assignment
- Order management

#### Main Methods
```typescript
class CategoryService {
  static createCategory(category: Omit<Category, 'id'>): Promise<string>
  static getCategories(userId: string): Promise<Category[]>
  static updateCategoryOrder(categoryId: string, newOrder: number): Promise<void>
  static deleteCategory(categoryId: string): Promise<void>
}
```

## Data Aggregation

### DailyAggregationService
Located in `app/(root)/services/dailyAggregationService.ts`

#### Key Features
- Daily transaction aggregation
- Statistical analysis
- Trend calculation
- Performance optimization

#### Main Methods
```typescript
class DailyAggregationService {
  static aggregateDailyData(userId: string, date: Date): Promise<void>
  static getAggregatedData(userId: string, dateRange: DateRange): Promise<AggregatedData[]>
  static calculateTrends(userId: string): Promise<TrendData>
}
```

## Data Preloading

### PreloadService
Located in `app/(root)/services/preloadService.ts`

#### Key Features
- Data caching
- Performance optimization
- Offline support
- Background processing

#### Main Methods
```typescript
class PreloadService {
  static preloadDashboardData(timeframe: Timeframe): Promise<void>
  static clearPreloadedData(): Promise<void>
  static getPreloadedData(key: string): Promise<any>
}
```

## User Management

### UserService
Located in `app/(root)/services/userService.ts`

#### Key Features
- User profile management
- Preference handling
- Settings management
- Account linking

#### Main Methods
```typescript
class UserService {
  static createUser(userId: string, email: string): Promise<void>
  static updateUserPreferences(userId: string, preferences: UserPreferences): Promise<void>
  static getUser(userId: string): Promise<User | null>
}
```

## Service Interactions

### Data Flow
1. User actions trigger service calls
2. Services validate and process data
3. Firebase integration handles persistence
4. UI updates reflect changes

### Error Handling
- Validation at service level
- Error propagation
- Recovery mechanisms
- User feedback

### Performance Considerations
- Batch operations
- Caching strategies
- Background processing
- Data optimization 