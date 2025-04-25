<script lang="ts">
  import { enhance } from "$app/forms";
  import { page } from "$app/stores";
  import { invalidate } from "$app/navigation";
  import { onMount } from 'svelte';

  // Access the habits data from the page load function
  $: habits = ($page.data.habits || []).filter(h => h.type === 'daily');
  $: formError = "";
  
  let showCreateForm = false;
  let newHabitName = "";
  let newHabitDescription = "";

  const toggleCreateForm = () => {
    showCreateForm = !showCreateForm;
    if (!showCreateForm) {
      // Reset form fields when hiding the form
      newHabitName = "";
      newHabitDescription = "";
      formError = "";
    }
  };

  // Enhanced chart dimensions
  const chartHeight = 80; 
  const chartMargin = { top: 20, right: 10, bottom: 20, left: 10 };
  let chartSvgElements = new Map();
  let chartWidths = new Map();

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

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatShortDate = (dateStr: string): string => {
    const options: Intl.DateTimeFormatOptions = { 
      month: 'short', 
      day: 'numeric' 
    };
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', options);
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

  const getMomentumClass = (momentum: number) => {
    if (momentum > 0) {
      return 'bg-green-100 text-green-800';
    } else if (momentum < 0) {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  const getMomentumColor = (momentum: number) => {
    if (momentum > 0) {
      return '#4caf50'; // Green
    } else if (momentum < 0) {
      return '#f44336'; // Red
    }
    return '#9e9e9e'; // Grey
  };
</script>

<div class="space-y-6 md:space-y-8">
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0">
    <div>
      <h1 class="text-xl sm:text-2xl font-bold text-gray-900">Daily Habits</h1>
      <p class="mt-1 text-sm text-gray-500">
        {formatDate(new Date())}
      </p>
      <p class="text-xs text-indigo-600 font-medium mt-1">Track habits on a daily basis</p>
    </div>
    <button
      on:click={toggleCreateForm}
      class="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 w-full sm:w-auto"
    >
      {showCreateForm ? "Cancel" : "Create New Habit"}
    </button>
  </div>

  {#if showCreateForm}
    <div class="bg-white p-4 sm:p-6 rounded-lg shadow-md border border-gray-200">
      <h2 class="text-lg font-medium text-gray-900 mb-4">Create New Daily Habit</h2>
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
                formError = "";
                // More comprehensive invalidation
                await invalidate('app:habits');
                await invalidate('daily-habits');
                await invalidate('/habits/daily');
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
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
        
        <div class="mb-4">
          <label for="description" class="block text-sm font-medium text-gray-700">Description (Optional)</label>
          <textarea
            id="description"
            name="description"
            bind:value={newHabitDescription}
            rows="3"
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          ></textarea>
        </div>
        
        <div class="flex justify-end">
          <button
            type="submit"
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Create Habit
          </button>
        </div>
      </form>
    </div>
  {/if}

  {#if habits.length === 0}
    <div class="bg-white p-4 sm:p-6 rounded-lg shadow-md border border-gray-200">
      <p class="text-gray-500 text-center">You don't have any daily habits yet. Create your first one!</p>
    </div>
  {:else}
    <div class="space-y-4 sm:space-y-6">
      {#each habits as habit}
        <div class="bg-white p-4 sm:p-6 rounded-lg shadow-md border-l-4 border-l-indigo-600 border-t border-r border-b border-gray-200">
          <div class="flex justify-between items-start mb-4">
            <div>
              <div class="flex items-center flex-wrap gap-2">
                <h3 class="text-base sm:text-lg font-medium text-gray-900">{habit.name}</h3>
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                  Daily
                </span>
              </div>
              {#if habit.description}
                <p class="text-sm text-gray-500 mt-1">{habit.description}</p>
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
              <div class="mb-1">
                <span class="text-xs font-medium text-gray-500">7-Day Momentum</span>
              </div>
              
              <div class="relative" style="height: {chartHeight}px;">
                <svg 
                  use:bindSvgElement={habit.id}
                  width="100%" 
                  height={chartHeight}
                  on:mousemove={(e) => handleMouseMove(e, habit)} 
                  on:mouseleave={() => handleMouseLeave(habit.id)}
                  class="overflow-visible"
                  role="img"
                  aria-label="Habit momentum chart for the past 7 days"
                >
                  <title>Momentum history for {habit.name}</title>
                  <desc>Line chart showing momentum trends over the past 7 days</desc>
                  
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
                          stroke="#4338ca" 
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
          
          <!-- Tracking UI -->
          <div class="mt-4">
            <form
              method="POST"
              action="?/trackHabit"
              use:enhance={({ formElement }) => {
                const habitId = formElement.elements.namedItem('habitId')?.value;
                const completed = formElement.elements.namedItem('completed')?.value === 'true';
                console.log(`[Form] Tracking habit ${habitId}: setting completed=${completed}`);
                
                return async ({ result }) => {
                  if (result.type === 'success') {
                    const data = result.data;
                    console.log('[Form] Habit tracking successful:', data);
                    
                    // Invalidate multiple dependency paths to ensure all data is refreshed
                    await invalidate('app:habits');
                    await invalidate('daily-habits');
                    await invalidate('app:momentum'); 
                    await invalidate('/habits/daily');
                    await invalidate('/dashboard');
                    
                    // Force a hard reload to ensure the browser gets a completely fresh state
                    console.log('[Form] Forcing page reload to ensure fresh data');
                    window.location.reload();
                  } else {
                    console.error('[Form] Habit tracking error:', result);
                  }
                };
              }}
              class="flex items-center"
            >
              <input type="hidden" name="habitId" value={habit.id} />
              
              {#if habit.todayRecord?.completed}
                <!-- Mark as incomplete -->
                <input type="hidden" name="completed" value="false" />
                <button
                  type="submit"
                  class="inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 w-full sm:w-auto"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                  </svg>
                  Completed
                </button>
              {:else}
                <!-- Mark as complete -->
                <input type="hidden" name="completed" value="true" />
                <button
                  type="submit"
                  class="inline-flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 w-full sm:w-auto"
                >
                  Mark as Complete
                </button>
              {/if}
            </form>
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
                    await invalidate('daily-habits');
                    await invalidate('/habits/daily');
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