<script lang="ts">
  import { enhance } from "$app/forms";
  import { page } from "$app/stores";
  import { invalidate } from "$app/navigation";
  import { onMount } from 'svelte';

  // Access the habits and current week data from the page load function
  $: habits = ($page.data.habits || []).filter(h => h.type === 'weekly');
  $: currentWeek = $page.data.currentWeek || { start: '', end: '' };
  $: formError = "";
  
  let showCreateForm = false;
  let newHabitName = "";
  let newHabitDescription = "";
  let newHabitTargetCount = 2; // Default minimum target is 2

  // Temporary variable for SVG binding
  let tempSvgElement: SVGElement | null = null;
  
  // Properly define the Svelte action for SVG binding
  function bindSvgElement(node: SVGElement, habitId: string) {
    // Store reference and initialize width
    chartSvgElements.set(habitId, node);
    updateChartWidth(habitId);
    
    return {
      update(newHabitId: string) {
        if (habitId !== newHabitId) {
          chartSvgElements.delete(habitId);
          chartSvgElements.set(newHabitId, node);
          updateChartWidth(newHabitId);
        }
      },
      destroy() {
        chartSvgElements.delete(habitId);
        chartWidths.delete(habitId);
      }
    };
  }

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

  // Format date for tooltip with more detail
  const formatDateDetailed = (dateStr: string): string => {
    const date = new Date(dateStr);
    // Format as "Weekday, Month Day, Year" (e.g., "Thursday, April 25, 2025")
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
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
    if (!habit.weekRecords) {
      console.log(`No weekRecords for habit ${habit.name}`);
      return false;
    }
    
    // Standardize the date format for comparison (ensure YYYY-MM-DD format)
    const standardDateStr = dateStr.split('T')[0];
    
    console.log(`Checking if habit ${habit.name} was completed on ${standardDateStr}`, habit.weekRecords);
    
    // Log all the record dates for debugging
    console.log(`Available dates for ${habit.name}:`, 
      habit.weekRecords.map(r => ({ 
        date: r.date, 
        standardized: r.date ? r.date.split('T')[0] : r.date,
        completed: r.completed
      }))
    );
    
    const isCompleted = habit.weekRecords.some((record: any) => {
      // Standardize record date format too
      const recordDateStr = record.date ? record.date.split('T')[0] : record.date;
      const matches = recordDateStr === standardDateStr;
      const isComplete = record.completed > 0;
      
      console.log(`Compare: [${recordDateStr}] vs [${standardDateStr}], Matches: ${matches}, Completed: ${isComplete}`);
      
      return matches && isComplete;
    });
    
    console.log(`Habit ${habit.name} completed on ${standardDateStr}: ${isCompleted}`);
    return isCompleted;
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

  // Enhanced chart dimensions
  const chartHeight = 80; 
  const chartMargin = { top: 20, right: 10, bottom: 20, left: 10 };
  let chartSvgElements = new Map();
  let chartWidths = new Map();

  // Function to update chart width based on container size
  function updateChartWidth(habitId: string) {
    const svg = chartSvgElements.get(habitId);
    if (svg) {
      const container = svg.parentElement;
      if (container) {
        const width = container.clientWidth - chartMargin.left - chartMargin.right;
        chartWidths.set(habitId, width);
        // Force svelte to update
        chartWidths = chartWidths;
      }
    }
  }

  onMount(() => {
    // Make charts responsive
    const handleResize = () => {
      habits.forEach(habit => updateChartWidth(habit.id));
    };
    
    // Initial update for all charts
    setTimeout(() => {
      habits.forEach(habit => updateChartWidth(habit.id));
      // Force update reactivity
      chartWidths = new Map(chartWidths);
    }, 10);
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });

  // Scale helpers
  function xScale(index: number, totalPoints: number, width: number) {
    return index * (width / (totalPoints - 1));
  }

  function yScale(value: number, minValue: number, maxValue: number) {
    const range = maxValue - minValue;
    const ratio = (value - minValue) / range;
    return chartHeight - chartMargin.bottom - (ratio * (chartHeight - chartMargin.top - chartMargin.bottom));
  }

  // Get min/max momentum values for scaling
  function getScalingValues(momentumHistory: {date: string, momentum: number | null}[]) {
    if (!momentumHistory || !momentumHistory.length) {
      return { minValue: -5, maxValue: 5 }; // Default range if no data
    }
    
    const validValues = momentumHistory
      .map(record => record.momentum)
      .filter(m => m !== null) as number[];
    
    if (!validValues.length) {
      return { minValue: -5, maxValue: 5 }; // Default range if all null
    }
    
    let minValue = Math.min(0, ...validValues); // Ensure 0 is visible
    let maxValue = Math.max(0, ...validValues); // Ensure 0 is visible
    
    // Add padding (20% on each side)
    const padding = Math.max(1, (maxValue - minValue) * 0.2);
    minValue = minValue - padding;
    maxValue = maxValue + padding;
    
    // Ensure minimum range if data is too flat
    if (maxValue - minValue < 2) {
      maxValue += 1;
      minValue -= 1;
    }
    
    return { minValue, maxValue };
  }

  // Hover state data for each habit chart
  let hoveredPoints = new Map();

  function handleMouseMove(event: MouseEvent, habit: any) {
    if (!habit.momentumHistory || habit.momentumHistory.length === 0) return;
    
    const habitId = habit.id;
    const svg = chartSvgElements.get(habitId);
    const chartWidth = chartWidths.get(habitId) || 100;
    
    if (!svg) return;
    
    const svgRect = svg.getBoundingClientRect();
    const mouseX = event.clientX - svgRect.left - chartMargin.left;
    
    // Find closest point based on x position
    const pointSpacing = chartWidth / (habit.momentumHistory.length - 1);
    let index = Math.round(mouseX / pointSpacing);
    
    // Ensure index is within bounds
    index = Math.max(0, Math.min(index, habit.momentumHistory.length - 1));
    
    const { minValue, maxValue } = getScalingValues(habit.momentumHistory);
    const point = habit.momentumHistory[index];
    
    if (point.momentum !== null) {
      hoveredPoints.set(habitId, {
        index,
        x: xScale(index, habit.momentumHistory.length, chartWidth),
        y: yScale(point.momentum, minValue, maxValue),
        momentum: point.momentum,
        date: point.date
      });
    }
  }

  function handleMouseLeave(habitId: string) {
    hoveredPoints.delete(habitId);
    hoveredPoints = hoveredPoints; // Trigger reactivity
  }
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
                // More comprehensive invalidation
                await invalidate('app:habits');
                await invalidate('weekly-habits');
                await invalidate('/habits/weekly');
                await invalidate('/dashboard');
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
          
          <!-- Enhanced Momentum Line Chart -->
          {#if habit.momentumHistory && habit.momentumHistory.length > 0}
            <div class="my-3">
              <div class="mb-1 flex justify-between">
                <span class="text-xs font-medium text-gray-500">8-Week Momentum</span>
              </div>
              
              <div class="relative" style="height: {chartHeight}px;">
                <svg 
                  role="img"
                  use:bindSvgElement={habit.id}
                  width="100%" 
                  height={chartHeight}
                  on:mousemove={(e) => handleMouseMove(e, habit)} 
                  on:mouseleave={() => handleMouseLeave(habit.id)}
                  class="overflow-visible"
                >
                  <g transform="translate({chartMargin.left}, {chartMargin.top})">
                    {#if chartWidths.has(habit.id) && chartWidths.get(habit.id) > 0}
                      {@const habitId = habit.id}
                      {@const chartWidth = chartWidths.get(habitId) || 0}
                      {@const { minValue, maxValue } = getScalingValues(habit.momentumHistory)}
                      {@const zeroLineY = yScale(0, minValue, maxValue)}
                      
                      <!-- Zero line -->
                      <line 
                        x1="0" 
                        y1={zeroLineY - chartMargin.top} 
                        x2={chartWidth} 
                        y2={zeroLineY - chartMargin.top} 
                        stroke="#e5e7eb" 
                        stroke-width="1" 
                        stroke-dasharray="4" 
                      />
                      
                      <!-- Line connecting data points -->
                      {#if habit.momentumHistory && habit.momentumHistory.length > 1}
                        <polyline 
                          points={habit.momentumHistory
                            .map((point, i) => point.momentum !== null ? 
                              `${xScale(i, habit.momentumHistory.length, chartWidth)},${yScale(point.momentum, minValue, maxValue) - chartMargin.top}` : '')
                            .filter(Boolean)
                            .join(' ')}
                          fill="none" 
                          stroke="#8b5cf6" 
                          stroke-width="2" 
                          stroke-linejoin="round"
                          stroke-linecap="round"
                        />
                      
                        <!-- Data points -->
                        {#each habit.momentumHistory as point, i}
                          {#if point.momentum !== null}
                            <circle
                              cx={xScale(i, habit.momentumHistory.length, chartWidth)}
                              cy={yScale(point.momentum, minValue, maxValue) - chartMargin.top}
                              r="3"
                              fill="white"
                              stroke={getMomentumColor(point.momentum)}
                              stroke-width="2"
                            />
                          {/if}
                        {/each}
                      {/if}
                      
                      <!-- Hover effects -->
                      {@const hoveredPoint = hoveredPoints.get(habitId)}
                      {#if hoveredPoint}
                        <line
                          x1={hoveredPoint.x}
                          y1="0"
                          x2={hoveredPoint.x}
                          y2={chartHeight - chartMargin.top - chartMargin.bottom}
                          stroke="#9ca3af"
                          stroke-width="1"
                          stroke-dasharray="4 4"
                        />
                        
                        <circle
                          cx={hoveredPoint.x}
                          cy={hoveredPoint.y - chartMargin.top}
                          r="5"
                          fill={getMomentumColor(hoveredPoint.momentum)}
                          stroke="#ffffff"
                          stroke-width="2"
                        />
                        
                        <!-- Tooltip -->
                        <rect
                          x={Math.min(Math.max(hoveredPoint.x - 60, 0), chartWidth - 120)}
                          y={Math.max(0, hoveredPoint.y - chartMargin.top - 45)}
                          width="120"
                          height="40"
                          rx="4"
                          fill="#111827"
                          opacity="0.95"
                        />
                        
                        <text
                          x={Math.min(Math.max(hoveredPoint.x, 60), chartWidth - 60)}
                          y={Math.max(15, hoveredPoint.y - chartMargin.top - 25)}
                          text-anchor="middle"
                          font-size="11"
                          fill="#ffffff"
                        >
                          {formatDateDetailed(hoveredPoint.date)}
                        </text>
                        
                        <text
                          x={Math.min(Math.max(hoveredPoint.x, 60), chartWidth - 60)}
                          y={Math.max(35, hoveredPoint.y - chartMargin.top - 5)}
                          text-anchor="middle"
                          font-size="12"
                          font-weight="bold"
                          fill="#ffffff"
                        >
                          Momentum: {hoveredPoint.momentum}
                        </text>
                      {/if}
                    {/if}
                  </g>
                </svg>
              </div>
              
              <!-- Date labels -->
              {#if habit.momentumHistory && habit.momentumHistory.length > 2}
                <div class="flex justify-between text-xs text-gray-400 mt-1 px-1">
                  <span>{formatShortDate(habit.momentumHistory[0].date)}</span>
                  <span>{formatShortDate(habit.momentumHistory[Math.floor(habit.momentumHistory.length / 2)].date)}</span>
                  <span>{formatShortDate(habit.momentumHistory[habit.momentumHistory.length - 1].date)}</span>
                </div>
              {/if}
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
                  use:enhance={(form) => {
                    const habitId = form?.elements?.namedItem('habitId')?.value;
                    const date = form?.elements?.namedItem('date')?.value;
                    console.log('Submitting weekly tracking form', { habitId, date });
                    
                    return async ({ result }) => {
                      if (result.type === 'success') {
                        console.log('Weekly tracking success:', result);
                        
                        // Add more aggressive data invalidation
                        await invalidate('app:habits');
                        await invalidate('weekly-habits'); 
                        await invalidate('/habits/weekly');
                        await invalidate('/dashboard');
                        
                        // Force page reload to ensure UI is updated
                        window.location.reload();
                      } else {
                        console.error('Weekly tracking error:', result);
                      }
                    };
                  }}
                  class="text-center"
                >
                  <input type="hidden" name="habitId" value={habit.id} />
                  <input type="hidden" name="date" value={dateStr} />
                  <!-- No completed flag - the server will toggle it -->
                  
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
                    // More comprehensive invalidation
                    await invalidate('app:habits');
                    await invalidate('weekly-habits'); 
                    await invalidate('/habits/weekly');
                    await invalidate('/dashboard');
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