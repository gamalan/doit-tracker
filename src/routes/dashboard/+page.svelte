<script lang="ts">
	import { page } from '$app/stores';
	import { enhance } from "$app/forms";
	import { invalidateAll } from "$app/navigation";
	
	// Get data from the server
	$: session = $page.data.session;
	$: dailyHabits = ($page.data.dailyHabits || []).filter(h => h.type === 'daily');
	$: weeklyHabits = ($page.data.weeklyHabits || []).filter(h => h.type === 'weekly');
	$: totalMomentum = $page.data.totalMomentum || 0;
	$: currentWeek = $page.data.currentWeek || { start: '', end: '' };

	// Momentum utility functions
	const getMomentumClass = (momentum: number) => {
		if (momentum > 20) return "text-green-600";
		if (momentum > 10) return "text-green-500";
		if (momentum > 0) return "text-green-400";
		if (momentum === 0) return "text-gray-500";
		if (momentum > -10) return "text-orange-400";
		if (momentum > -20) return "text-orange-500";
		return "text-red-500";
	};

	const getTotalMomentumClass = (momentum: number) => {
		if (momentum > 100) return "text-green-600";
		if (momentum > 50) return "text-green-500";
		if (momentum > 20) return "text-green-400";
		if (momentum > 0) return "text-green-300";
		if (momentum === 0) return "text-gray-500";
		if (momentum > -20) return "text-orange-400";
		if (momentum > -50) return "text-orange-500";
		return "text-red-500";
	};

	const formatDate = (dateStr: string): string => {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', { 
			weekday: 'short', 
			month: 'short', 
			day: 'numeric' 
		});
	};
</script>

<div class="space-y-8">
	<div class="bg-white rounded-lg shadow-md p-6">
		<h1 class="text-2xl font-bold text-gray-900 mb-4">Welcome, {session?.user?.name || 'User'}!</h1>
		
		<div class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-2">Your Momentum Score</h2>
			<div class="bg-gray-100 p-4 rounded-lg">
				<div class="text-center">
					<p class={`text-5xl font-bold ${getTotalMomentumClass(totalMomentum)}`}>{totalMomentum}</p>
					{#if totalMomentum > 0}
						<p class="text-sm text-gray-500 mt-1">Great progress! Keep building those habits.</p>
					{:else if totalMomentum === 0}
						<p class="text-sm text-gray-500 mt-1">Start building habits to increase your score.</p>
					{:else}
						<p class="text-sm text-gray-500 mt-1">Time to get back on track with your habits!</p>
					{/if}
				</div>
			</div>
		</div>
		
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			<!-- Daily Habits Summary -->
			<div class="bg-indigo-50 p-4 rounded-lg">
				<div class="flex justify-between items-center mb-3">
					<h3 class="text-lg font-medium text-indigo-700">Daily Habits</h3>
					<a href="/habits/daily" class="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
						View All
					</a>
				</div>
				
				{#if dailyHabits.length === 0}
					<p class="text-gray-600 mb-4">You haven't created any daily habits yet.</p>
					<a href="/habits/daily" class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
						Create Daily Habit
					</a>
				{:else}
					<div class="space-y-3 mb-4">
						{#each dailyHabits.slice(0, 3) as habit}
							<div class="bg-white p-3 rounded-md shadow-sm border border-indigo-100">
								<div class="flex justify-between items-center">
									<div class="flex-1">
										<p class="font-medium text-gray-800">{habit.name}</p>
										<div class="flex items-center mt-1">
											<span class={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getMomentumClass(habit.todayRecord?.momentum || 0)}`}>
												{habit.todayRecord?.momentum || 0}
											</span>
											<span class="ml-2 text-xs text-gray-500">
												{habit.todayRecord?.completed ? 'Completed today' : 'Not completed'}
											</span>
										</div>
									</div>
									
									{#if !habit.todayRecord?.completed}
										<form
											method="POST"
											action="/habits/daily?/trackHabit"
											use:enhance={() => {
												return async ({ result }) => {
													if (result.type === 'success') {
														await invalidateAll();
													}
												};
											}}
										>
											<input type="hidden" name="habitId" value={habit.id} />
											<input type="hidden" name="completed" value="true" />
											<button
												type="submit"
												class="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
											>
												Track
											</button>
										</form>
									{/if}
								</div>
							</div>
						{/each}
						
						{#if dailyHabits.length > 3}
							<p class="text-xs text-center text-gray-500">
								+ {dailyHabits.length - 3} more habit{dailyHabits.length - 3 > 1 ? 's' : ''}
							</p>
						{/if}
					</div>
				{/if}
			</div>
			
			<!-- Weekly Habits Summary -->
			<div class="bg-purple-50 p-4 rounded-lg">
				<div class="flex justify-between items-center mb-3">
					<h3 class="text-lg font-medium text-purple-700">Weekly Habits</h3>
					<div class="text-xs text-purple-600">
						<span class="font-medium">Week of:</span> {currentWeek.start ? formatDate(currentWeek.start) : ''}
					</div>
				</div>
				
				{#if weeklyHabits.length === 0}
					<p class="text-gray-600 mb-4">You haven't created any weekly habits yet.</p>
					<a href="/habits/weekly" class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500">
						Create Weekly Habit
					</a>
				{:else}
					<div class="space-y-3 mb-4">
						{#each weeklyHabits.slice(0, 3) as habit}
							<div class="bg-white p-3 rounded-md shadow-sm border border-purple-100">
								<div class="flex justify-between items-start">
									<div class="flex-1">
										<p class="font-medium text-gray-800">{habit.name}</p>
										<div class="flex items-center mt-1">
											<span class={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getMomentumClass(habit.latestRecord?.momentum || 0)}`}>
												{habit.latestRecord?.momentum || 0}
											</span>
											<span class="ml-2 text-xs text-gray-500">
												{habit.completionsThisWeek} / {habit.targetCount || 2} completed
											</span>
										</div>
									</div>
									
									<div class="text-xs text-center">
										{#if habit.targetMet}
											<span class="inline-flex items-center px-2 py-1 rounded bg-green-100 text-green-800">
												Target met
											</span>
										{:else}
											<a 
												href="/habits/weekly" 
												class="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-purple-600 hover:bg-purple-700"
											>
												Track
											</a>
										{/if}
									</div>
								</div>
								
								<!-- Simple progress bar -->
								<div class="h-1.5 bg-gray-200 rounded-full overflow-hidden mt-2">
									<div 
										class={`h-full ${habit.targetMet ? 'bg-green-500' : 'bg-purple-500'}`} 
										style={`width: ${Math.min((habit.completionsThisWeek / (habit.targetCount || 2)) * 100, 100)}%`}
									></div>
								</div>
							</div>
						{/each}
						
						{#if weeklyHabits.length > 3}
							<p class="text-xs text-center text-gray-500">
								+ {weeklyHabits.length - 3} more habit{weeklyHabits.length - 3 > 1 ? 's' : ''}
							</p>
						{/if}
					</div>
					
					<div class="text-right">
						<a href="/habits/weekly" class="text-sm text-purple-600 hover:text-purple-800 font-medium">
							View All
						</a>
					</div>
				{/if}
			</div>
		</div>
	</div>
	
	<!-- Tips and Insights -->
	<div class="bg-white rounded-lg shadow-md p-6">
		<h2 class="text-xl font-semibold text-gray-800 mb-4">Habit Building Tips</h2>
		
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div class="bg-blue-50 p-4 rounded-lg">
				<h3 class="text-md font-medium text-blue-700 mb-2">Consistency is Key</h3>
				<p class="text-sm text-gray-600">
					Small, consistent actions build more momentum than occasional bursts of effort. Aim to complete your habits regularly, even when you don't feel motivated.
				</p>
			</div>
			
			<div class="bg-green-50 p-4 rounded-lg">
				<h3 class="text-md font-medium text-green-700 mb-2">Celebrate Your Wins</h3>
				<p class="text-sm text-gray-600">
					Acknowledge your progress, no matter how small. Each completed habit is building your momentum and helping you create lasting change.
				</p>
			</div>
			
			<div class="bg-amber-50 p-4 rounded-lg">
				<h3 class="text-md font-medium text-amber-700 mb-2">Be Guilt-Free</h3>
				<p class="text-sm text-gray-600">
					Missing a day doesn't mean failure. The guilt-free approach helps you bounce back quickly instead of giving up after a slip.
				</p>
			</div>
			
			<div class="bg-purple-50 p-4 rounded-lg">
				<h3 class="text-md font-medium text-purple-700 mb-2">Track Your Progress</h3>
				<p class="text-sm text-gray-600">
					Seeing your momentum score grow is motivating. Regular tracking helps you spot patterns and make adjustments to your habits.
				</p>
			</div>
		</div>
	</div>
</div>