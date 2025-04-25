<script lang="ts">
  import { enhance } from "$app/forms";
  import { page } from "$app/stores";
  import { invalidateAll } from "$app/navigation";

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

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getMomentumClass = (momentum: number) => {
    if (momentum > 20) return "text-green-600";
    if (momentum > 10) return "text-green-500";
    if (momentum > 0) return "text-green-400";
    if (momentum === 0) return "text-gray-500";
    if (momentum > -10) return "text-orange-400";
    if (momentum > -20) return "text-orange-500";
    return "text-red-500";
  };
</script>

<div class="space-y-8">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Daily Habits</h1>
      <p class="mt-1 text-sm text-gray-500">
        {formatDate(new Date())}
      </p>
      <p class="text-xs text-indigo-600 font-medium mt-1">Track habits on a daily basis</p>
    </div>
    <button
      on:click={toggleCreateForm}
      class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
    >
      {showCreateForm ? "Cancel" : "Create New Habit"}
    </button>
  </div>

  {#if showCreateForm}
    <div class="bg-white p-6 rounded-lg shadow-md border border-gray-200">
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
    <div class="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <p class="text-gray-500 text-center">You don't have any daily habits yet. Create your first one!</p>
    </div>
  {:else}
    <div class="space-y-6">
      {#each habits as habit}
        <div class="bg-white p-6 rounded-lg shadow-md border-l-4 border-l-indigo-600 border-t border-r border-b border-gray-200">
          <div class="flex justify-between items-start mb-4">
            <div>
              <div class="flex items-center">
                <h3 class="text-lg font-medium text-gray-900">{habit.name}</h3>
                <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                  Daily
                </span>
              </div>
              {#if habit.description}
                <p class="text-sm text-gray-500">{habit.description}</p>
              {/if}
            </div>
            
            <!-- Momentum badge -->
            <span 
              class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getMomentumClass(habit.latestRecord?.momentum || 0)}`}
            >
              {habit.latestRecord?.momentum || 0}
            </span>
          </div>
          
          <!-- Tracking UI -->
          <div class="mt-4">
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
              class="flex items-center space-x-4"
            >
              <input type="hidden" name="habitId" value={habit.id} />
              
              {#if habit.todayRecord?.completed}
                <!-- Mark as incomplete -->
                <input type="hidden" name="completed" value="false" />
                <button
                  type="submit"
                  class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
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
                  class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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