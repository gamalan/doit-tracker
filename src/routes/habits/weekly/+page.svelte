<script lang="ts">
  import { enhance } from "$app/forms";
  import { page } from "$app/stores";
  import { invalidateAll } from "$app/navigation";

  // Access the habits and current week data from the page load function
  $: habits = ($page.data.habits || []).filter(h => h.type === 'weekly');
  $: currentWeek = $page.data.currentWeek || { start: '', end: '' };
  $: formError = "";
  
  let showCreateForm = false;
  let newHabitName = "";
  let newHabitDescription = "";
  let newHabitTargetCount = 2; // Default minimum target is 2

  const toggleCreateForm = () => {
    showCreateForm = !showCreateForm;
    if (!showCreateForm) {
      // Reset form fields when hiding the form
      newHabitName = "";
      newHabitDescription = "";
      newHabitTargetCount = 2;
      formError = "";
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatShortDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short',
      day: 'numeric'
    });
  };

  const getDaysOfWeek = (startDate: string, endDate: string): Date[] => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = [];
    
    const currentDay = new Date(start);
    while (currentDay <= end) {
      days.push(new Date(currentDay));
      currentDay.setDate(currentDay.getDate() + 1);
    }
    
    return days;
  };

  // Find if a habit was completed on a specific date
  const isCompletedOnDate = (habit: any, dateStr: string): boolean => {
    if (!habit.weekRecords) return false;
    return habit.weekRecords.some((record: any) => 
      record.date === dateStr && record.completed > 0
    );
  };

  const getMomentumClass = (momentum: number) => {
    if (momentum > 30) return "text-green-600";
    if (momentum > 20) return "text-green-500";
    if (momentum > 10) return "text-green-400";
    if (momentum > 0) return "text-green-300";
    if (momentum === 0) return "text-gray-500";
    if (momentum > -20) return "text-orange-400";
    if (momentum > -30) return "text-orange-500";
    return "text-red-500";
  };

  const getMomentumColor = (momentum: number | null) => {
    if (momentum === null) return "#d1d5db"; // gray-300
    if (momentum > 30) return "#059669"; // green-600
    if (momentum > 20) return "#10b981"; // green-500
    if (momentum > 10) return "#34d399"; // green-400
    if (momentum > 0) return "#a7f3d0"; // green-300
    if (momentum === 0) return "#6b7280"; // gray-500
    if (momentum > -20) return "#fb923c"; // orange-400
    if (momentum > -30) return "#f97316"; // orange-500
    return "#ef4444"; // red-500
  };

  const getProgressClass = (completions: number, target: number) => {
    if (completions >= target) return "bg-green-500";
    if (completions > 0) return "bg-yellow-500";
    return "bg-gray-300";
  };

  // Graph dimensions
  const graphHeight = 50;
  const graphWidth = 150;
  const graphPadding = 5;
  
  // Function to create the SVG path for the momentum line
  const createMomentumPath = (momentumHistory: {date: string, momentum: number | null}[]) => {
    if (!momentumHistory || momentumHistory.length === 0) return "";
    
    // Filter out null momentum values but keep track of their positions
    const validPoints = momentumHistory
      .map((record, index) => ({ 
        index, 
        momentum: record.momentum === null ? null : record.momentum 
      }))
      .filter(p => p.momentum !== null);
    
    if (validPoints.length === 0) return "";
    
    // Find min and max for scaling
    const momentumValues = validPoints.map(p => p.momentum);
    const minMomentum = Math.min(-1, ...momentumValues as number[]); // At least -1 for proper scaling
    const maxMomentum = Math.max(1, ...momentumValues as number[]); // At least 1 for proper scaling
    const range = maxMomentum - minMomentum;
    
    // Create the SVG path
    const points = validPoints.map(point => {
      const x = graphPadding + (point.index / (momentumHistory.length - 1)) * (graphWidth - 2 * graphPadding);
      const normalizedMomentum = (point.momentum as number - minMomentum) / range;
      const y = graphHeight - graphPadding - normalizedMomentum * (graphHeight - 2 * graphPadding);
      return `${x},${y}`;
    });
    
    return `M${points.join(" L")}`;
  };
  
  // Function to create circle points for each data point
  const createMomentumPoints = (momentumHistory: {date: string, momentum: number | null}[]) => {
    if (!momentumHistory || momentumHistory.length === 0) return [];
    
    // Find min and max for scaling
    const momentumValues = momentumHistory
      .map(record => record.momentum)
      .filter(m => m !== null) as number[];
    
    if (momentumValues.length === 0) return [];
    
    const minMomentum = Math.min(-1, ...momentumValues);
    const maxMomentum = Math.max(1, ...momentumValues);
    const range = maxMomentum - minMomentum;
    
    return momentumHistory.map((record, index) => {
      if (record.momentum === null) return null;
      
      const x = graphPadding + (index / (momentumHistory.length - 1)) * (graphWidth - 2 * graphPadding);
      const normalizedMomentum = (record.momentum - minMomentum) / range;
      const y = graphHeight - graphPadding - normalizedMomentum * (graphHeight - 2 * graphPadding);
      
      return {
        x,
        y,
        momentum: record.momentum,
        date: record.date
      };
    }).filter(p => p !== null);
  };
  
  // Draw the zero line position
  const getZeroLineY = (momentumHistory: {date: string, momentum: number | null}[]) => {
    const momentumValues = momentumHistory
      .map(record => record.momentum)
      .filter(m => m !== null) as number[];
    
    if (momentumValues.length === 0) return graphHeight / 2;
    
    const minMomentum = Math.min(-1, ...momentumValues);
    const maxMomentum = Math.max(1, ...momentumValues);
    const range = maxMomentum - minMomentum;
    
    const normalizedZero = (0 - minMomentum) / range;
    return graphHeight - graphPadding - normalizedZero * (graphHeight - 2 * graphPadding);
  };
</script>

<div class="space-y-8">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Weekly Habits</h1>
      <p class="mt-1 text-sm text-gray-500">
        Week of {formatDate(currentWeek.start)} to {formatDate(currentWeek.end)}
      </p>
      <p class="text-xs text-purple-600 font-medium mt-1">Track habits on a weekly basis (minimum {habits.length > 0 ? habits[0].targetCount || 2 : 2} times per week)</p>
    </div>
    <button
      on:click={toggleCreateForm}
      class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
    >
      {showCreateForm ? "Cancel" : "Create New Habit"}
    </button>
  </div>

  {#if showCreateForm}
    <div class="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <h2 class="text-lg font-medium text-gray-900 mb-4">Create New Weekly Habit</h2>
      <form
        method="POST"
        action="?/createHabit"
        use:enhance={() => {
          return async ({ result }) => {
            if (result.type === 'success') {
              if (result.data?.success) {
                showCreateForm = false;
                newHabitName = "";
                newHabitDescription = "";
                newHabitTargetCount = 2;
                formError = "";
                await invalidateAll(); // Refresh data
              } else if (result.data?.error) {
                formError = result.data.error;
              }
            }
          };
        }}
      >
        {#if formError}
          <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {formError}
          </div>
        {/if}
        
        <div class="mb-4">
          <label for="name" class="block text-sm font-medium text-gray-700">Habit Name</label>
          <input
            type="text"
            id="name"
            name="name"
            bind:value={newHabitName}
            required
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
          />
        </div>
        
        <div class="mb-4">
          <label for="description" class="block text-sm font-medium text-gray-700">Description (Optional)</label>
          <textarea
            id="description"
            name="description"
            bind:value={newHabitDescription}
            rows="3"
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
          ></textarea>
        </div>

        <div class="mb-4">
          <label for="targetCount" class="block text-sm font-medium text-gray-700">Weekly Target (minimum 2)</label>
          <input
            type="number"
            id="targetCount"
            name="targetCount"
            bind:value={newHabitTargetCount}
            min="2"
            required
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
          />
          <p class="mt-1 text-xs text-gray-500">
            This is how many times per week you aim to complete this habit. 
            You'll get bonus momentum when you reach this target.
          </p>
        </div>
        
        <div class="flex justify-end">
          <button
            type="submit"
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            Create Habit
          </button>
        </div>
      </form>
    </div>
  {/if}

  {#if habits.length === 0}
    <div class="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <p class="text-gray-500 text-center">You don't have any weekly habits yet. Create your first one!</p>
    </div>
  {:else}
    <div class="space-y-6">
      {#each habits as habit}
        <div class="bg-white p-6 rounded-lg shadow-md border-l-4 border-l-purple-600 border-t border-r border-b border-gray-200">
          <div class="flex justify-between items-start mb-4">
            <div>
              <div class="flex items-center">
                <h3 class="text-lg font-medium text-gray-900">{habit.name}</h3>
                <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                  Weekly
                </span>
              </div>
              {#if habit.description}
                <p class="text-sm text-gray-500">{habit.description}</p>
              {/if}
            </div>
            
            <!-- Momentum badge -->
            <span 
              class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getMomentumClass(habit.currentMomentum || 0)}`}
            >
              {habit.currentMomentum || 0}
            </span>
          </div>
          
          <!-- Momentum Graph -->
          {#if habit.momentumHistory && habit.momentumHistory.length > 0}
            <div class="my-3">
              <div class="mb-1">
                <span class="text-xs font-medium text-gray-500">8-Week Momentum</span>
              </div>
              
              <div class="relative">
                <svg width={graphWidth} height={graphHeight} class="w-full">
                  <!-- Zero reference line -->
                  <line 
                    x1={graphPadding} 
                    y1={getZeroLineY(habit.momentumHistory)} 
                    x2={graphWidth - graphPadding} 
                    y2={getZeroLineY(habit.momentumHistory)} 
                    stroke="#e5e7eb" 
                    stroke-width="1" 
                    stroke-dasharray="4" 
                  />
                  
                  <!-- Momentum line -->
                  {#if createMomentumPath(habit.momentumHistory)}
                    <path 
                      d={createMomentumPath(habit.momentumHistory)} 
                      fill="none" 
                      stroke="#8b5cf6" 
                      stroke-width="2" 
                      stroke-linejoin="round"
                    />
                  {/if}
                  
                  <!-- Data points -->
                  {#each createMomentumPoints(habit.momentumHistory) as point}
                    <circle 
                      cx={point.x} 
                      cy={point.y} 
                      r="3" 
                      fill="white" 
                      stroke={getMomentumColor(point.momentum)} 
                      stroke-width="2"
                    >
                      <title>{point.date}: {point.momentum}</title>
                    </circle>
                  {/each}
                </svg>
              </div>
              
              <!-- Show select dates to save space -->
              <div class="flex justify-between text-xs text-gray-400 mt-1 px-1">
                <span>{formatShortDate(habit.momentumHistory[0].date)}</span>
                <span>{formatShortDate(habit.momentumHistory[3].date)}</span>
                <span>{formatShortDate(habit.momentumHistory[7].date)}</span>
              </div>
            </div>
          {/if}
          
          <!-- Progress bar -->
          <div class="mb-4">
            <div class="flex justify-between items-center mb-1">
              <div class="text-xs text-gray-500">Weekly Progress</div>
              <div class="text-xs font-medium text-gray-700">
                {habit.completionsThisWeek} / {habit.targetCount || 2}
                {#if habit.targetMet}
                  <span class="ml-1 text-green-500">(Target met!)</span>
                {/if}
              </div>
            </div>
            <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                class={`h-full ${getProgressClass(habit.completionsThisWeek, habit.targetCount || 2)}`} 
                style={`width: ${Math.min((habit.completionsThisWeek / (habit.targetCount || 2)) * 100, 100)}%`}
              ></div>
            </div>
          </div>
          
          <!-- Day of week tracking -->
          <div class="mb-4">
            <div class="text-sm font-medium text-gray-700 mb-2">Track completions:</div>
            
            <div class="grid grid-cols-7 gap-2">
              {#each getDaysOfWeek(currentWeek.start, currentWeek.end) as day}
                {@const dateStr = day.toISOString().split('T')[0]}
                {@const isCompleted = isCompletedOnDate(habit, dateStr)}
                
                <form
                  method="POST"
                  action="?/trackHabit"
                  use:enhance={() => {
                    return async ({ result }) => {
                      if (result.type === 'success') {
                        await invalidateAll();
                      }
                    };
                  }}
                  class="text-center"
                >
                  <input type="hidden" name="habitId" value={habit.id} />
                  <input type="hidden" name="date" value={dateStr} />
                  
                  <button
                    type="submit"
                    class={`w-10 h-10 flex items-center justify-center rounded-full border 
                      ${isCompleted 
                        ? 'bg-purple-100 border-purple-300 text-purple-700' 
                        : 'border-gray-300 bg-white text-gray-500 hover:bg-purple-50'}`}
                    title={`${day.toLocaleDateString('en-US', {weekday: 'long'})} - ${isCompleted ? 'Completed' : 'Not completed'}`}
                  >
                    <span class="text-xs font-medium">
                      {day.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1)}
                    </span>
                  </button>
                  <div class="text-xs mt-1">
                    {day.getDate()}
                  </div>
                </form>
              {/each}
            </div>
          </div>
          
          <!-- Archive button -->
          <div class="mt-4 text-right">
            <form
              method="POST"
              action="?/archiveHabit"
              use:enhance={() => {
                return async ({ result }) => {
                  if (result.type === 'success' && result.data?.success) {
                    await invalidateAll();
                  }
                };
              }}
            >
              <input type="hidden" name="habitId" value={habit.id} />
              <button
                type="submit"
                class="text-xs text-gray-500 hover:text-red-500 underline"
              >
                Archive habit
              </button>
            </form>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>