import fc from 'fast-check';

/**
 * Model-Based Testing Framework Templates
 *
 * Provides templates and interfaces for testing stateful systems by modeling
 * expected behavior and comparing it against actual implementation.
 *
 * Note: These are templates - actual implementations should import expect()
 * from your testing framework and implement the specific system interfaces.
 */

// ===== CORE MODEL-BASED TESTING INTERFACES =====

/**
 * Base command interface for model-based testing
 */
export abstract class ModelCommand<Model, Real> {
  /**
   * Check if this command can be executed given the current model state
   */
  abstract check(model: Model): boolean;

  /**
   * Execute the command on both model and real system
   * Note: In actual tests, import expect() from your testing framework
   */
  abstract run(model: Model, real: Real): void;

  /**
   * String representation for debugging
   */
  abstract toString(): string;

  /**
   * Optional: Generate arbitrary data for this command
   */
  static arbitrary?(): fc.Arbitrary<any>;
}

/**
 * State machine for model-based testing
 */
export interface StateMachine<Model, Real> {
  /**
   * Initial state factory
   */
  initial(): { model: Model; real: Real };

  /**
   * Available commands
   */
  commands(): fc.Arbitrary<ModelCommand<Model, Real>>[];

  /**
   * Cleanup after test
   */
  cleanup?(real: Real): void | Promise<void>;
}

// ===== EXAMPLE INTERFACES =====

export interface CartModel {
  items: Array<{ id: string; quantity: number; price: number }>;
  customerId: string;
  discountCode?: string;
}

export interface CartReal {
  addItem(id: string, quantity: number, price: number): void;
  removeItem(id: string): void;
  updateQuantity(id: string, quantity: number): void;
  applyDiscount(code: string): void;
  getTotal(): number;
  getItemCount(): number;
  clear(): void;
}

export interface AuthModel {
  users: Map<
    string,
    { email: string; passwordHash: string; isActive: boolean }
  >;
  sessions: Map<string, { userId: string; expiresAt: Date }>;
  currentUser?: string;
}

export interface AuthReal {
  register(email: string, password: string): Promise<string>;
  login(email: string, password: string): Promise<string>;
  logout(sessionId: string): Promise<void>;
  getCurrentUser(sessionId: string): Promise<string | null>;
  deleteUser(userId: string): Promise<void>;
}

export interface TransactionModel {
  accounts: Map<string, number>; // accountId -> balance
  transactions: Array<{
    id: string;
    from: string;
    to: string;
    amount: number;
    timestamp: Date;
    status: 'pending' | 'completed' | 'failed';
  }>;
}

export interface TransactionReal {
  createAccount(accountId: string, initialBalance: number): Promise<void>;
  transfer(from: string, to: string, amount: number): Promise<string>;
  getBalance(accountId: string): Promise<number>;
  getTransactionHistory(accountId: string): Promise<any[]>;
}

// ===== COMMAND GENERATORS =====

/**
 * Generator for shopping cart commands
 */
export const cartCommandGenerators = {
  addItem: fc.record({
    itemId: fc.uuid(),
    quantity: fc.integer({ min: 1, max: 10 }),
    price: fc.float({
      min: Math.fround(0.01),
      max: Math.fround(1000),
      noNaN: true,
    }),
  }),

  removeItem: fc.record({
    itemId: fc.string(),
  }),

  updateQuantity: fc.record({
    itemId: fc.string(),
    newQuantity: fc.integer({ min: 1, max: 20 }),
  }),

  applyDiscount: fc.record({
    code: fc.string({ minLength: 3, maxLength: 10 }),
  }),
};

/**
 * Generator for authentication commands
 */
export const authCommandGenerators = {
  register: fc.record({
    email: fc.emailAddress(),
    password: fc.string({ minLength: 8, maxLength: 50 }),
  }),

  login: fc.record({
    email: fc.emailAddress(),
    password: fc.string({ minLength: 8, maxLength: 50 }),
  }),

  logout: fc.record({
    sessionId: fc.string(),
  }),
};

/**
 * Generator for transaction commands
 */
export const transactionCommandGenerators = {
  createAccount: fc.record({
    accountId: fc.uuid(),
    initialBalance: fc.float({ min: 0, max: 10000, noNaN: true }),
  }),

  transfer: fc.record({
    from: fc.string(),
    to: fc.string(),
    amount: fc.float({
      min: Math.fround(0.01),
      max: Math.fround(1000),
      noNaN: true,
    }),
  }),
};

// ===== INVARIANT CHECKERS =====

/**
 * Common invariants for stateful systems
 */
export const stateInvariants = {
  /**
   * Total should always equal sum of parts
   */
  conservationLaw: <T extends { getTotal(): number; getParts(): number[] }>(
    system: T
  ): boolean => {
    const total = system.getTotal();
    const sum = system.getParts().reduce((a, b) => a + b, 0);
    return Math.abs(total - sum) < 0.01; // Allow floating point errors
  },

  /**
   * System should never be in invalid state
   */
  validState: <T extends { isValid(): boolean }>(system: T): boolean => {
    return system.isValid();
  },

  /**
   * Monotonic property (values only increase)
   */
  monotonic: <T extends { getValue(): number }>(
    previousValue: number,
    system: T
  ): boolean => {
    return system.getValue() >= previousValue;
  },

  /**
   * Non-negative values
   */
  nonNegative: <T extends { getValue(): number }>(system: T): boolean => {
    return system.getValue() >= 0;
  },

  /**
   * Finite values (not NaN or Infinity)
   */
  finite: <T extends { getValue(): number }>(system: T): boolean => {
    return Number.isFinite(system.getValue());
  },
};

// ===== TEST PATTERNS =====

/**
 * Common test patterns for model-based testing
 */
export const testPatterns = {
  /**
   * Basic CRUD operations pattern
   */
  crudPattern: fc.array(
    fc.oneof(
      fc.constant('create'),
      fc.constant('read'),
      fc.constant('update'),
      fc.constant('delete')
    ),
    { minLength: 5, maxLength: 20 }
  ),

  /**
   * Shopping workflow pattern
   */
  shoppingWorkflow: fc.array(
    fc.oneof(
      fc.constant('addItem'),
      fc.constant('updateQuantity'),
      fc.constant('removeItem'),
      fc.constant('applyDiscount'),
      fc.constant('clear')
    ),
    { minLength: 3, maxLength: 15 }
  ),

  /**
   * User session pattern
   */
  sessionPattern: fc.array(
    fc.oneof(
      fc.constant('login'),
      fc.constant('performAction'),
      fc.constant('logout')
    ),
    { minLength: 2, maxLength: 10 }
  ),

  /**
   * Financial transaction pattern
   */
  transactionPattern: fc.array(
    fc.oneof(
      fc.constant('createAccount'),
      fc.constant('deposit'),
      fc.constant('withdraw'),
      fc.constant('transfer')
    ),
    { minLength: 4, maxLength: 12 }
  ),
};

// ===== EXAMPLE USAGE TEMPLATES =====

/**
 * Example shopping cart model-based test template
 */
export const exampleShoppingCartTest = `
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { cartCommandGenerators, stateInvariants } from '@airbolt/types';

class AddItemCommand {
  constructor(private itemId: string, private quantity: number, private price: number) {}

  check(model: CartModel): boolean {
    return this.quantity > 0 && this.price >= 0;
  }

  run(model: CartModel, real: CartReal): void {
    // Update model
    const existingItem = model.items.find(item => item.id === this.itemId);
    if (existingItem) {
      existingItem.quantity += this.quantity;
    } else {
      model.items.push({
        id: this.itemId,
        quantity: this.quantity,
        price: this.price,
      });
    }

    // Update real system
    real.addItem(this.itemId, this.quantity, this.price);

    // Verify consistency
    expect(real.getItemCount()).toBe(
      model.items.reduce((sum, item) => sum + item.quantity, 0)
    );
  }

  toString(): string {
    return \`AddItem(\${this.itemId}, \${this.quantity}, $\${this.price})\`;
  }

  static arbitrary() {
    return cartCommandGenerators.addItem.map(
      ({ itemId, quantity, price }) => new AddItemCommand(itemId, quantity, price)
    );
  }
}

describe('Shopping Cart State Machine', () => {
  it('should maintain consistency across operations', () => {
    fc.assert(
      fc.property(
        fc.commands([
          AddItemCommand.arbitrary(),
          // Add other command arbitraries...
        ], { maxCommands: 20 }),
        (commands) => {
          const cart = new ShoppingCart();
          const model = { items: [], customerId: 'test' };

          fc.modelRun(() => ({ model, real: cart }), commands);
        }
      )
    );
  });
});
`;

/**
 * Example authentication model-based test template
 */
export const exampleAuthTest = `
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { authCommandGenerators, stateInvariants } from '@airbolt/types';

class RegisterCommand {
  constructor(private email: string, private password: string) {}

  check(model: AuthModel): boolean {
    return !Array.from(model.users.values()).some(user => user.email === this.email) &&
           this.email.includes('@') &&
           this.password.length >= 8;
  }

  async run(model: AuthModel, real: AuthReal): Promise<void> {
    // Update model
    const userId = \`user_\${Date.now()}_\${Math.random()}\`;
    model.users.set(userId, {
      email: this.email,
      passwordHash: \`hash_of_\${this.password}\`,
      isActive: true,
    });

    // Update real system
    const realUserId = await real.register(this.email, this.password);

    // Verify consistency
    expect(realUserId).toBeTruthy();
    expect(typeof realUserId).toBe('string');
  }

  toString(): string {
    return \`Register(\${this.email})\`;
  }

  static arbitrary() {
    return authCommandGenerators.register.map(
      ({ email, password }) => new RegisterCommand(email, password)
    );
  }
}
`;

/**
 * Example transaction system model-based test template
 */
export const exampleTransactionTest = `
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { transactionCommandGenerators, stateInvariants } from '@airbolt/types';

class TransferCommand {
  constructor(private from: string, private to: string, private amount: number) {}

  check(model: TransactionModel): boolean {
    const fromBalance = model.accounts.get(this.from) ?? 0;
    return model.accounts.has(this.from) &&
           model.accounts.has(this.to) &&
           this.from !== this.to &&
           this.amount > 0 &&
           fromBalance >= this.amount;
  }

  async run(model: TransactionModel, real: TransactionReal): Promise<void> {
    // Update model
    const fromBalance = model.accounts.get(this.from)!;
    const toBalance = model.accounts.get(this.to)!;

    model.accounts.set(this.from, fromBalance - this.amount);
    model.accounts.set(this.to, toBalance + this.amount);

    model.transactions.push({
      id: \`tx_\${Date.now()}_\${Math.random()}\`,
      from: this.from,
      to: this.to,
      amount: this.amount,
      timestamp: new Date(),
      status: 'completed',
    });

    // Update real system
    const transactionId = await real.transfer(this.from, this.to, this.amount);

    // Verify consistency
    const realFromBalance = await real.getBalance(this.from);
    const realToBalance = await real.getBalance(this.to);

    expect(realFromBalance).toBeCloseTo(model.accounts.get(this.from)!, 2);
    expect(realToBalance).toBeCloseTo(model.accounts.get(this.to)!, 2);
    expect(transactionId).toBeTruthy();
  }

  toString(): string {
    return \`Transfer($\${this.amount} from \${this.from} to \${this.to})\`;
  }

  static arbitrary() {
    return transactionCommandGenerators.transfer.map(
      ({ from, to, amount }) => new TransferCommand(from, to, amount)
    );
  }
}
`;

// ===== HELPER UTILITIES =====

/**
 * Utility functions for model-based testing
 */
export const modelTestingUtils = {
  /**
   * Generate a sequence of operations that should maintain invariants
   */
  generateOperationSequence: (
    operations: string[],
    length: number
  ): fc.Arbitrary<string[]> =>
    fc.array(fc.constantFrom(...operations), {
      minLength: 1,
      maxLength: length,
    }),

  /**
   * Create a template for property test with state machine invariants
   * Note: This is a template - actual implementation requires proper fast-check setup
   */
  createInvariantTestTemplate: (invariantNames: string[]): string => {
    return `
// Example property test for state machine invariants:
fc.assert(
  fc.property(
    fc.commands([/* your command generators */], { maxCommands: 30 }),
    (commands) => {
      const { model, real } = stateMachine.initial();

      try {
        fc.modelRun(() => ({ model, real }), commands);

        // Check invariants: ${invariantNames.join(', ')}
        ${invariantNames.map(name => `expect(${name}Invariant(model, real)).toBe(true);`).join('\n        ')}

        return true;
      } finally {
        if (stateMachine.cleanup) {
          stateMachine.cleanup(real);
        }
      }
    }
  )
);`;
  },
};
