/**
 * Unit tests for habit momentum calculations
 * Tests the core logic requirements for daily and weekly habits
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock the database and dependencies
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn()
};

const mockQuery = {
  from: vi.fn(() => mockQuery),
  where: vi.fn(() => mockQuery),
  orderBy: vi.fn(() => mockQuery),
  limit: vi.fn(() => mockQuery),
  returning: vi.fn(() => Promise.resolve([{}]))
};

mockDb.select.mockReturnValue(mockQuery);
mockDb.insert.mockReturnValue(mockQuery);
mockDb.update.mockReturnValue(mockQuery);

// Mock the database client
vi.mock('$lib/db/client', () => ({
  getDb: () => mockDb
}));

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: () => 'test-id-123'
}));

// Import after mocking
const { calculateDailyHabitMomentum, calculateWeeklyHabitMomentum } = await import('../../src/lib/habits.js');

describe('Daily Habit Momentum Calculations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Consecutive Streak Building', () => {
    it('should start with +1 momentum for first completion', async () => {
      // Mock no previous records
      mockQuery.limit.mockResolvedValueOnce([]);
      
      const momentum = await calculateDailyHabitMomentum('habit1', 'user1', '2024-01-01', 1);
      expect(momentum).toBe(1);
    });

    it('should increment momentum for consecutive days up to +7', async () => {
      const testCases = [
        { previousMomentum: 1, expected: 2 },
        { previousMomentum: 2, expected: 3 },
        { previousMomentum: 3, expected: 4 },
        { previousMomentum: 4, expected: 5 },
        { previousMomentum: 5, expected: 6 },
        { previousMomentum: 6, expected: 7 },
        { previousMomentum: 7, expected: 7 }, // Cap at 7
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        
        // Mock previous day record with positive completion
        mockQuery.limit.mockResolvedValueOnce([{
          date: '2024-01-01',
          completed: 1,
          momentum: testCase.previousMomentum
        }]);

        const momentum = await calculateDailyHabitMomentum('habit1', 'user1', '2024-01-02', 1);
        expect(momentum).toBe(testCase.expected);
      }
    });
  });

  describe('Missing Day Penalty Logic', () => {
    it('should reset positive momentum to 0 when missing a day', async () => {
      // Mock previous day record with positive momentum but not completed
      mockQuery.orderBy.mockReturnValueOnce(mockQuery);
      mockQuery.limit.mockResolvedValueOnce([{
        date: '2024-01-01',
        completed: 1,
        momentum: 5
      }]);

      const momentum = await calculateDailyHabitMomentum('habit1', 'user1', '2024-01-02', 0);
      expect(momentum).toBe(0);
    });

    it('should apply consecutive miss penalties down to -3', async () => {
      const testCases = [
        { previousMomentum: 0, expected: -1 },
        { previousMomentum: -1, expected: -2 },
        { previousMomentum: -2, expected: -3 },
        { previousMomentum: -3, expected: -3 }, // Cap at -3
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        
        // Mock previous record with negative momentum
        mockQuery.orderBy.mockReturnValueOnce(mockQuery);
        mockQuery.limit.mockResolvedValueOnce([{
          date: '2024-01-01',
          completed: 0,
          momentum: testCase.previousMomentum
        }]);

        const momentum = await calculateDailyHabitMomentum('habit1', 'user1', '2024-01-02', 0);
        expect(momentum).toBe(testCase.expected);
      }
    });
  });

  describe('Streak Reset After Miss', () => {
    it('should reset to +1 when completing after missing days', async () => {
      // Mock previous record indicating missed days
      mockQuery.limit.mockResolvedValueOnce([{
        date: '2024-01-01',
        completed: 0,
        momentum: -2
      }]);

      const momentum = await calculateDailyHabitMomentum('habit1', 'user1', '2024-01-02', 1);
      expect(momentum).toBe(1);
    });
  });
});

describe('Weekly Habit Momentum Calculations', () => {
  const mockHabit = {
    id: 'habit1',
    name: 'Test Habit',
    targetCount: 2
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Base Completion Points', () => {
    it('should give +1 point per completion regardless of target', async () => {
      // Mock current week records with 1 completion
      mockQuery.where.mockReturnValueOnce(mockQuery);
      mockQuery.limit.mockResolvedValueOnce([{
        completed: 1
      }]);
      
      // Mock previous week check - no records
      mockQuery.where.mockReturnValueOnce(mockQuery);
      mockQuery.limit.mockResolvedValueOnce([]);

      const momentum = await calculateWeeklyHabitMomentum(mockHabit, 'user1', '2024-01-01', '2024-01-07');
      expect(momentum).toBe(1); // 1 completion, target not met
    });

    it('should give +3 points for 3 completions even if target is 2', async () => {
      // Mock current week records with 3 completions
      mockQuery.where.mockReturnValueOnce(mockQuery);
      mockQuery.limit.mockResolvedValueOnce([
        { completed: 1 },
        { completed: 1 },
        { completed: 1 }
      ]);
      
      // Mock previous week check
      mockQuery.where.mockReturnValueOnce(mockQuery);
      mockQuery.limit.mockResolvedValueOnce([]);

      const momentum = await calculateWeeklyHabitMomentum(mockHabit, 'user1', '2024-01-01', '2024-01-07');
      expect(momentum).toBe(13); // 3 completions + 10 target bonus
    });
  });

  describe('Target Completion Bonuses', () => {
    it('should add +10 bonus when target is reached', async () => {
      // Mock current week records meeting target (2/2)
      mockQuery.where.mockReturnValueOnce(mockQuery);
      mockQuery.limit.mockResolvedValueOnce([
        { completed: 1 },
        { completed: 1 }
      ]);
      
      // Mock previous week check - no records
      mockQuery.where.mockReturnValueOnce(mockQuery);
      mockQuery.limit.mockResolvedValueOnce([]);

      const momentum = await calculateWeeklyHabitMomentum(mockHabit, 'user1', '2024-01-01', '2024-01-07');
      expect(momentum).toBe(12); // 2 completions + 10 target bonus
    });

    it('should add consecutive completion bonus up to +40 total', async () => {
      // Mock current week records meeting target
      mockQuery.where.mockReturnValueOnce(mockQuery);
      mockQuery.limit.mockResolvedValueOnce([
        { completed: 1 },
        { completed: 1 }
      ]);
      
      // Mock previous week also meeting target
      mockQuery.where.mockReturnValueOnce(mockQuery);
      mockQuery.limit.mockResolvedValueOnce([
        { completed: 1 },
        { completed: 1 }
      ]);

      const momentum = await calculateWeeklyHabitMomentum(mockHabit, 'user1', '2024-01-01', '2024-01-07');
      expect(momentum).toBe(22); // 2 completions + 10 target + 10 consecutive bonus
    });
  });

  describe('Missing Week Penalties', () => {
    it('should reset to 0 for first missed week', async () => {
      // Mock current week with no completions
      mockQuery.where.mockReturnValueOnce(mockQuery);
      mockQuery.limit.mockResolvedValueOnce([]);
      
      // Mock previous week had completions
      mockQuery.where.mockReturnValueOnce(mockQuery);
      mockQuery.limit.mockResolvedValueOnce([
        { completed: 1 }
      ]);
      
      // Mock no records before previous week
      mockQuery.where.mockReturnValueOnce(mockQuery);
      mockQuery.orderBy.mockReturnValueOnce(mockQuery);
      mockQuery.limit.mockResolvedValueOnce([]);

      const momentum = await calculateWeeklyHabitMomentum(mockHabit, 'user1', '2024-01-01', '2024-01-07');
      expect(momentum).toBe(0);
    });

    it('should apply -10 penalty for consecutive missed weeks down to -30', async () => {
      // Mock current week with no completions
      mockQuery.where.mockReturnValueOnce(mockQuery);
      mockQuery.limit.mockResolvedValueOnce([]);
      
      // Mock previous week also no completions
      mockQuery.where.mockReturnValueOnce(mockQuery);
      mockQuery.limit.mockResolvedValueOnce([]);
      
      // Mock last record with negative momentum
      mockQuery.where.mockReturnValueOnce(mockQuery);
      mockQuery.orderBy.mockReturnValueOnce(mockQuery);
      mockQuery.limit.mockResolvedValueOnce([{
        momentum: -20
      }]);

      const momentum = await calculateWeeklyHabitMomentum(mockHabit, 'user1', '2024-01-01', '2024-01-07');
      expect(momentum).toBe(-30); // -20 - 10 = -30 (capped)
    });
  });
});

describe('Momentum Caps and Limits', () => {
  it('should cap daily habit momentum at +7', async () => {
    mockQuery.limit.mockResolvedValueOnce([{
      date: '2024-01-01',
      completed: 1,
      momentum: 10 // Hypothetically higher than cap
    }]);

    const momentum = await calculateDailyHabitMomentum('habit1', 'user1', '2024-01-02', 1);
    expect(momentum).toBeLessThanOrEqual(7);
  });

  it('should cap daily habit momentum at -3', async () => {
    mockQuery.orderBy.mockReturnValueOnce(mockQuery);
    mockQuery.limit.mockResolvedValueOnce([{
      date: '2024-01-01',
      completed: 0,
      momentum: -10 // Hypothetically lower than cap
    }]);

    const momentum = await calculateDailyHabitMomentum('habit1', 'user1', '2024-01-02', 0);
    expect(momentum).toBeGreaterThanOrEqual(-3);
  });

  it('should cap weekly habit momentum at +40', async () => {
    const mockHabit = { id: 'habit1', name: 'Test', targetCount: 2 };
    
    // Mock massive completions (should still cap at 40)
    mockQuery.where.mockReturnValueOnce(mockQuery);
    mockQuery.limit.mockResolvedValueOnce([
      ...Array(20).fill({ completed: 1 }) // 20 completions
    ]);
    
    // Mock previous week also meeting target
    mockQuery.where.mockReturnValueOnce(mockQuery);
    mockQuery.limit.mockResolvedValueOnce([
      { completed: 1 },
      { completed: 1 }
    ]);

    const momentum = await calculateWeeklyHabitMomentum(mockHabit, 'user1', '2024-01-01', '2024-01-07');
    expect(momentum).toBeLessThanOrEqual(40);
  });

  it('should cap weekly habit momentum at -30', async () => {
    const mockHabit = { id: 'habit1', name: 'Test', targetCount: 2 };
    
    // Mock current week with no completions
    mockQuery.where.mockReturnValueOnce(mockQuery);
    mockQuery.limit.mockResolvedValueOnce([]);
    
    // Mock previous week also no completions
    mockQuery.where.mockReturnValueOnce(mockQuery);
    mockQuery.limit.mockResolvedValueOnce([]);
    
    // Mock very negative previous momentum
    mockQuery.where.mockReturnValueOnce(mockQuery);
    mockQuery.orderBy.mockReturnValueOnce(mockQuery);
    mockQuery.limit.mockResolvedValueOnce([{
      momentum: -100 // Hypothetically much lower
    }]);

    const momentum = await calculateWeeklyHabitMomentum(mockHabit, 'user1', '2024-01-01', '2024-01-07');
    expect(momentum).toBeGreaterThanOrEqual(-30);
  });
});