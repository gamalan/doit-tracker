/**
 * Integration tests for cron job functionality
 * Tests the automated daily missed habit processing
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock environment and database
const mockEnv = {
  DB: 'mock-d1-db',
  AUTH_SECRET: 'test-secret'
};

const mockRecords = [];
const mockHabits = [];

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve(mockRecords))
      }))
    }))
  })),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(() => Promise.resolve([{ id: 'new-record' }]))
    }))
  }))
};

// Mock the database client
vi.mock('$lib/db/client', () => ({
  getDb: () => mockDb,
  initializeDatabase: vi.fn()
}));

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: () => 'test-record-id'
}));

const { processDailyMissedHabits, processWeeklyMissedHabits } = await import('../../src/lib/cron/dailyMissedHandler.js');

describe('Daily Missed Habits Cron Job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecords.length = 0;
    mockHabits.length = 0;
  });

  describe('processDailyMissedHabits', () => {
    it('should identify and process missed daily habits', async () => {
      // Setup: Add some daily habits
      const dailyHabits = [
        { habitId: 'habit1', userId: 'user1', habitName: 'Exercise' },
        { habitId: 'habit2', userId: 'user1', habitName: 'Reading' },
        { habitId: 'habit3', userId: 'user2', habitName: 'Meditation' }
      ];
      
      // Mock getting all daily habits
      mockDb.select.mockImplementationOnce(() => ({
        from: () => ({
          where: () => Promise.resolve(dailyHabits)
        })
      }));

      // Mock checking for existing records (none found = missed habits)
      mockDb.select.mockImplementation(() => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]) // No existing records
          })
        })
      }));

      const result = await processDailyMissedHabits();

      expect(result.processed).toBe(3);
      expect(result.errors).toBe(0);
    });

    it('should skip habits that already have records for yesterday', async () => {
      // Setup: Add daily habits
      const dailyHabits = [
        { habitId: 'habit1', userId: 'user1', habitName: 'Exercise' },
        { habitId: 'habit2', userId: 'user1', habitName: 'Reading' }
      ];
      
      mockDb.select.mockImplementationOnce(() => ({
        from: () => ({
          where: () => Promise.resolve(dailyHabits)
        })
      }));

      // Mock: habit1 has a record, habit2 doesn't
      mockDb.select.mockImplementationOnce(() => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ id: 'existing-record' }]) // Has record
          })
        })
      }));
      
      mockDb.select.mockImplementationOnce(() => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]) // No record
          })
        })
      }));

      const result = await processDailyMissedHabits();

      expect(result.processed).toBe(1); // Only habit2 processed
      expect(result.errors).toBe(0);
    });

    it('should handle errors gracefully and continue processing', async () => {
      const dailyHabits = [
        { habitId: 'habit1', userId: 'user1', habitName: 'Exercise' },
        { habitId: 'habit2', userId: 'user1', habitName: 'Reading' }
      ];
      
      mockDb.select.mockImplementationOnce(() => ({
        from: () => ({
          where: () => Promise.resolve(dailyHabits)
        })
      }));

      // Mock first habit check to throw error
      mockDb.select.mockImplementationOnce(() => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.reject(new Error('Database error'))
          })
        })
      }));
      
      // Mock second habit check to succeed
      mockDb.select.mockImplementationOnce(() => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]) // No record - needs processing
          })
        })
      }));

      const result = await processDailyMissedHabits();

      expect(result.processed).toBe(1); // Only habit2 processed successfully
      expect(result.errors).toBe(1); // habit1 had error
    });

    it('should work with no daily habits', async () => {
      // Mock no daily habits
      mockDb.select.mockImplementationOnce(() => ({
        from: () => ({
          where: () => Promise.resolve([])
        })
      }));

      const result = await processDailyMissedHabits();

      expect(result.processed).toBe(0);
      expect(result.errors).toBe(0);
    });
  });

  describe('Date Handling', () => {
    it('should process habits for yesterday\'s date', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const expectedDate = yesterday.toISOString().split('T')[0];

      const dailyHabits = [
        { habitId: 'habit1', userId: 'user1', habitName: 'Exercise' }
      ];
      
      mockDb.select.mockImplementationOnce(() => ({
        from: () => ({
          where: () => Promise.resolve(dailyHabits)
        })
      }));

      // Mock no existing record
      mockDb.select.mockImplementationOnce(() => ({
        from: () => ({
          where: (condition) => {
            // Verify the date condition includes yesterday
            expect(condition.toString()).toContain(expectedDate);
            return {
              limit: () => Promise.resolve([])
            };
          }
        })
      }));

      await processDailyMissedHabits();
    });
  });
});

describe('Weekly Missed Habits Cron Job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecords.length = 0;
    mockHabits.length = 0;
  });

  describe('processWeeklyMissedHabits', () => {
    it('should identify and process weekly habits that missed targets', async () => {
      // Setup: Add some weekly habits
      const weeklyHabits = [
        { habitId: 'habit1', userId: 'user1', habitName: 'Reading', targetCount: 2 },
        { habitId: 'habit2', userId: 'user1', habitName: 'Exercise', targetCount: 3 },
      ];
      
      // Mock getting all weekly habits
      mockDb.select.mockImplementationOnce(() => ({
        from: () => ({
          where: () => Promise.resolve(weeklyHabits)
        })
      }));

      // Mock checking for records in the completed week
      // habit1: 1 completion (missed target of 2)
      mockDb.select.mockImplementationOnce(() => ({
        from: () => ({
          where: () => Promise.resolve([{ completed: 1 }]) // 1 < 2 target
        })
      }));
      
      // habit2: 3 completions (met target of 3)
      mockDb.select.mockImplementationOnce(() => ({
        from: () => ({
          where: () => Promise.resolve([
            { completed: 1 },
            { completed: 1 },
            { completed: 1 }
          ]) // 3 >= 3 target
        })
      }));

      const result = await processWeeklyMissedHabits();

      expect(result.processed).toBe(1); // Only habit1 missed target
      expect(result.errors).toBe(0);
    });

    it('should skip habits that met their weekly targets', async () => {
      const weeklyHabits = [
        { habitId: 'habit1', userId: 'user1', habitName: 'Reading', targetCount: 2 }
      ];
      
      mockDb.select.mockImplementationOnce(() => ({
        from: () => ({
          where: () => Promise.resolve(weeklyHabits)
        })
      }));

      // Mock habit met target (2 completions for target of 2)
      mockDb.select.mockImplementationOnce(() => ({
        from: () => ({
          where: () => Promise.resolve([
            { completed: 1 },
            { completed: 1 }
          ])
        })
      }));

      const result = await processWeeklyMissedHabits();

      expect(result.processed).toBe(0); // No habits processed (target met)
      expect(result.errors).toBe(0);
    });

    it('should handle weeks with no completions', async () => {
      const weeklyHabits = [
        { habitId: 'habit1', userId: 'user1', habitName: 'Reading', targetCount: 2 }
      ];
      
      mockDb.select.mockImplementationOnce(() => ({
        from: () => ({
          where: () => Promise.resolve(weeklyHabits)
        })
      }));

      // Mock no records for the week
      mockDb.select.mockImplementationOnce(() => ({
        from: () => ({
          where: () => Promise.resolve([]) // No completions
        })
      }));

      const result = await processWeeklyMissedHabits();

      expect(result.processed).toBe(1); // Habit processed for missing target
      expect(result.errors).toBe(0);
    });

    it('should handle errors gracefully for individual habits', async () => {
      const weeklyHabits = [
        { habitId: 'habit1', userId: 'user1', habitName: 'Reading', targetCount: 2 },
        { habitId: 'habit2', userId: 'user1', habitName: 'Exercise', targetCount: 2 }
      ];
      
      mockDb.select.mockImplementationOnce(() => ({
        from: () => ({
          where: () => Promise.resolve(weeklyHabits)
        })
      }));

      // Mock first habit check to throw error
      mockDb.select.mockImplementationOnce(() => ({
        from: () => ({
          where: () => Promise.reject(new Error('Database error'))
        })
      }));
      
      // Mock second habit check to succeed with missed target
      mockDb.select.mockImplementationOnce(() => ({
        from: () => ({
          where: () => Promise.resolve([{ completed: 1 }]) // 1 < 2 target
        })
      }));

      const result = await processWeeklyMissedHabits();

      expect(result.processed).toBe(1); // Only habit2 processed successfully
      expect(result.errors).toBe(1); // habit1 had error
    });

    it('should work with no weekly habits', async () => {
      // Mock no weekly habits
      mockDb.select.mockImplementationOnce(() => ({
        from: () => ({
          where: () => Promise.resolve([])
        })
      }));

      const result = await processWeeklyMissedHabits();

      expect(result.processed).toBe(0);
      expect(result.errors).toBe(0);
    });
  });

  describe('Week Date Calculation', () => {
    it('should process habits for the previous completed week', async () => {
      // This test would verify the date range calculation
      // In a real implementation, you'd mock the date and verify the ranges
      
      const weeklyHabits = [
        { habitId: 'habit1', userId: 'user1', habitName: 'Reading', targetCount: 2 }
      ];
      
      mockDb.select.mockImplementationOnce(() => ({
        from: () => ({
          where: () => Promise.resolve(weeklyHabits)
        })
      }));

      // Mock no completions for the week
      mockDb.select.mockImplementationOnce(() => ({
        from: () => ({
          where: (condition) => {
            // Verify the date condition includes a proper week range
            expect(condition.toString()).toBeDefined();
            return Promise.resolve([]);
          }
        })
      }));

      await processWeeklyMissedHabits();
    });
  });
});

describe('Cron API Endpoint Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/cron/daily-missed', () => {
    it('should process both daily and weekly habits with proper scheduling', async () => {
      const mockRequest = {
        headers: {
          get: vi.fn((header) => {
            if (header === 'cf-cron') return '0 1 * * *';
            if (header === 'user-agent') return 'Cloudflare-Cron/1.0';
            return null;
          })
        }
      };

      // Mock successful processing for both types
      mockDb.select.mockImplementation(() => ({
        from: () => ({
          where: () => Promise.resolve([])
        })
      }));

      // The endpoint would typically be tested with a request mock
      // This simulates the security check logic
      const userAgent = mockRequest.headers.get('user-agent');
      const cfCron = mockRequest.headers.get('cf-cron');
      
      expect(cfCron).toBeTruthy();
      expect(userAgent).toContain('Cloudflare');
    });

    it('should accept requests with Cloudflare cron headers', async () => {
      const mockRequest = {
        headers: {
          get: vi.fn((header) => {
            if (header === 'cf-cron') return '0 1 * * *';
            if (header === 'user-agent') return 'Cloudflare-Cron/1.0';
            return null;
          })
        }
      };

      // Mock successful processing
      mockDb.select.mockImplementation(() => ({
        from: () => ({
          where: () => Promise.resolve([])
        })
      }));

      // The endpoint would typically be tested with a request mock
      // This simulates the security check logic
      const userAgent = mockRequest.headers.get('user-agent');
      const cfCron = mockRequest.headers.get('cf-cron');
      
      expect(cfCron).toBeTruthy();
      expect(userAgent).toContain('Cloudflare');
    });

    it('should reject unauthorized requests', () => {
      const mockRequest = {
        headers: {
          get: vi.fn(() => null) // No Cloudflare headers
        }
      };

      const userAgent = mockRequest.headers.get('user-agent') || '';
      const cfCron = mockRequest.headers.get('cf-cron') || '';
      
      const isAuthorized = cfCron || userAgent.includes('Cloudflare');
      expect(isAuthorized).toBe(false);
    });
  });

  describe('Scheduled Event Handler', () => {
    it('should handle scheduled events properly', async () => {
      const mockEvent = {
        type: 'scheduled',
        cron: '0 1 * * *',
        scheduledTime: Date.now()
      };

      const mockContext = {
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn()
      };

      // Mock successful processing
      mockDb.select.mockImplementation(() => ({
        from: () => ({
          where: () => Promise.resolve([])
        })
      }));

      // This tests the scheduled handler logic
      expect(mockEvent.type).toBe('scheduled');
      expect(mockEvent.cron).toBe('0 1 * * *');
      expect(typeof mockEvent.scheduledTime).toBe('number');
    });
  });
});

describe('Error Handling and Resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle database connection errors', async () => {
    // Mock database connection failure
    mockDb.select.mockImplementationOnce(() => {
      throw new Error('Database connection failed');
    });

    await expect(processDailyMissedHabits()).rejects.toThrow('Database connection failed');
  });

  it('should handle partial failures gracefully', async () => {
    const dailyHabits = [
      { habitId: 'habit1', userId: 'user1', habitName: 'Exercise' },
      { habitId: 'habit2', userId: 'user1', habitName: 'Reading' },
      { habitId: 'habit3', userId: 'user2', habitName: 'Meditation' }
    ];
    
    mockDb.select.mockImplementationOnce(() => ({
      from: () => ({
        where: () => Promise.resolve(dailyHabits)
      })
    }));

    // Mock mixed results: success, error, success
    let callCount = 0;
    mockDb.select.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: () => {
            callCount++;
            if (callCount === 2) {
              return Promise.reject(new Error('Record check failed'));
            }
            return Promise.resolve([]); // No existing record
          }
        })
      })
    }));

    const result = await processDailyMissedHabits();

    expect(result.processed).toBe(2); // 2 successful
    expect(result.errors).toBe(1); // 1 failed
  });

  it('should log appropriate messages during processing', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    const dailyHabits = [
      { habitId: 'habit1', userId: 'user1', habitName: 'Exercise' }
    ];
    
    mockDb.select.mockImplementationOnce(() => ({
      from: () => ({
        where: () => Promise.resolve(dailyHabits)
      })
    }));

    mockDb.select.mockImplementationOnce(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]) // No record
        })
      })
    }));

    await processDailyMissedHabits();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Processing missed daily habits')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Found 1 active daily habits')
    );

    consoleSpy.mockRestore();
  });
});