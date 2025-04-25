<script lang="ts">
	import { page } from '$app/stores';
	import { enhance } from "$app/forms";
	import { invalidate } from "$app/navigation";
	import { onMount } from 'svelte';
	
	// Get data from the server
	$: session = $page.data.session;
	$: dailyHabits = ($page.data.dailyHabits || []).filter(h => h.type === 'daily');
	$: weeklyHabits = ($page.data.weeklyHabits || []).filter(h => h.type === 'weekly');
	$: totalMomentum = $page.data.totalMomentum || 0;
	$: currentWeek = $page.data.currentWeek || { start: '', end: '' };
	$: momentumHistory = $page.data.momentumHistory || [];

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

	// Updated date formatting function for better readability
	const formatDate = (dateStr: string): string => {
		const date = new Date(dateStr);
		// Format as "MMM DD" (e.g., "Apr 25")
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

	// Line chart rendering functions
	function getMomentumColor(momentum: number): string {
		if (momentum > 20) return "#16a34a"; // green-600
		if (momentum > 10) return "#22c55e"; // green-500
		if (momentum > 0) return "#4ade80"; // green-400
		if (momentum === 0) return "#9ca3af"; // gray-400
		if (momentum > -10) return "#fb923c"; // orange-400
		if (momentum > -20) return "#f97316"; // orange-500
		return "#ef4444"; // red-500
	}

	// Chart dimensions
	const chartHeight = 150; // pixels
	const chartMargin = { top: 30, right: 30, bottom: 40, left: 40 }; // Increased top margin for tooltips
	let chartWidth = 0;
	let chartSvg: SVGSVGElement;

	// Add missing variables for chart scaling
	let maxMomentum = 10; // Default maximum
	let minMomentum = -10; // Default minimum

	// Responsive chart sizing
	function updateChartWidth() {
		if (chartSvg) {
			const container = chartSvg.parentElement;
			if (container) {
				chartWidth = container.clientWidth - chartMargin.left - chartMargin.right;
			}
		}
	}

	onMount(() => {
		updateChartWidth();
		window.addEventListener('resize', updateChartWidth);
		return () => window.removeEventListener('resize', updateChartWidth);
	});

	// Improved chart scale calculations
	$: {
		// Find raw min/max values
		let rawMax = momentumHistory.length > 0 ? Math.max(...momentumHistory.map(d => d.momentum)) : 1;
		let rawMin = momentumHistory.length > 0 ? Math.min(...momentumHistory.map(d => d.momentum)) : 0;
		
		// Apply minimum thresholds for better visualization
		rawMax = Math.max(rawMax, 5); // Ensure we show at least 0-5 range for positive values
		rawMin = Math.min(rawMin, -5); // Ensure we show at least 0 to -5 range for negative values
		
		// Add generous padding (30% on each side)
		maxMomentum = rawMax + Math.abs(rawMax * 0.3);
		minMomentum = rawMin - Math.abs(rawMin * 0.3);
		
		// Ensure zero is in the middle if we have both positive and negative values
		if (rawMax > 0 && rawMin < 0) {
			// Balance the chart around zero
			const absMax = Math.max(Math.abs(rawMax), Math.abs(rawMin));
			maxMomentum = absMax * 1.3; // Add padding
			minMomentum = -absMax * 1.3; // Keep symmetric
		}
	}

	// Scale helpers
	$: xScale = (index: number) => {
		return index * (chartWidth / (momentumHistory.length - 1));
	};

	$: yScale = (value: number) => {
		const range = maxMomentum - minMomentum;
		const ratio = (value - minMomentum) / range;
		return chartHeight - (ratio * chartHeight);
	};

	// Calculate zero line position
	$: zeroLineY = yScale(0);

	// Line generator
	$: points = momentumHistory.length > 0 ? momentumHistory.map((point, i) => {
		return `${xScale(i)},${yScale(point.momentum)}`;
	}).join(' ') : '';

	// Hover state
	let hoveredPoint: { index: number, x: number, y: number, momentum: number, date: string } | null = null;
	// Tooltip position values
	let tooltipX = 0;
	let tooltipY = 0;
	let tooltipTextX = 0;
	let tooltipTextY1 = 0;
	let tooltipTextY2 = 0;

	// Improved hover state handling
	function handleMouseMove(event: MouseEvent) {
		if (momentumHistory.length === 0 || !chartWidth) return;
		
		const svgRect = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
		const mouseX = event.clientX - svgRect.left - chartMargin.left;
		
		// Find closest point based on x position
		const pointSpacing = chartWidth / (momentumHistory.length - 1);
		let index = Math.round(mouseX / pointSpacing);
		
		// Ensure index is within bounds
		index = Math.max(0, Math.min(index, momentumHistory.length - 1));
		
		const point = momentumHistory[index];
		hoveredPoint = {
			index,
			x: xScale(index),
			y: yScale(point.momentum),
			momentum: point.momentum,
			date: point.date
		};
		
		// Calculate tooltip positions immediately when point changes
		updateTooltipPosition();
	}

	function handleMouseLeave() {
		hoveredPoint = null;
	}

	// Move tooltip positioning logic to a separate function
	function updateTooltipPosition() {
		if (!hoveredPoint) return;
		
		const x = hoveredPoint.x;
		const y = hoveredPoint.y;
		
		const tooltipWidth = 120;
		const tooltipHeight = 45;
		const tooltipPadding = 10;
		
		// Default position (above point)
		tooltipX = x - tooltipWidth / 2;
		tooltipY = y - tooltipHeight - tooltipPadding;
		let arrowDown = true; // tooltip is above point
		
		// If too close to top, place below the point
		if (tooltipY < 0) {
			tooltipY = y + tooltipPadding;
			arrowDown = false; // tooltip is below point
		}
		
		// If too close to left edge
		if (tooltipX < 0) {
			tooltipX = 0;
		}
		// If too close to right edge
		else if (tooltipX + tooltipWidth > chartWidth) {
			tooltipX = chartWidth - tooltipWidth;
		}
		
		// Position the text inside the tooltip with fixed offsets
		tooltipTextX = tooltipX + (tooltipWidth / 2); // Center text horizontally in tooltip
		tooltipTextY1 = tooltipY + 20; // Position first text line
		tooltipTextY2 = tooltipY + 35; // Position second text line
	}
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
		
		<!-- Momentum History Chart (30-day rolling) -->
		<div class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-2">Momentum History (30 Days)</h2>
			<div class="bg-gray-100 p-4 rounded-lg">
				{#if momentumHistory && momentumHistory.length > 0}
					<div class="w-full relative" 
						style="height: {chartHeight + chartMargin.top + chartMargin.bottom}px">
						<svg 
							bind:this={chartSvg} 
							width="100%" 
							height="100%" 
							on:mousemove={handleMouseMove} 
							on:mouseleave={handleMouseLeave}
							class="overflow-visible"
							role="img"
							aria-label="Momentum history chart for the past 30 days"
						>
							<title>Momentum history chart for the past 30 days</title>
							<desc>Line chart showing momentum trends over the past 30 days</desc>
							<g transform="translate({chartMargin.left}, {chartMargin.top})">
								<!-- Y-axis value indicators -->
								<line x1="0" y1="0" x2="0" y2={chartHeight} stroke="#e5e7eb" stroke-width="1" />
								<text x="-5" y="5" text-anchor="end" font-size="10" fill="#6b7280">{Math.round(maxMomentum)}</text>
								<text x="-5" y={chartHeight} text-anchor="end" font-size="10" fill="#6b7280">{Math.round(minMomentum)}</text>
								
								<!-- Zero line -->
								<line 
									x1="0" 
									y1={zeroLineY} 
									x2={chartWidth} 
									y2={zeroLineY} 
									stroke="#9ca3af" 
									stroke-width="1" 
									stroke-dasharray="4 4" 
								/>
								<text x="-5" y={zeroLineY + 5} text-anchor="end" font-size="10" fill="#6b7280">0</text>
								
								<!-- Line chart -->
								{#if chartWidth > 0}
									<polyline 
										points={points} 
										fill="none" 
										stroke="#4338ca"
										stroke-width="2"
										stroke-linejoin="round"
										stroke-linecap="round"
									/>
									
									<!-- Data points -->
									{#each momentumHistory as point, i}
										<circle
											cx={xScale(i)}
											cy={yScale(point.momentum)}
											r="4"
											fill={getMomentumColor(point.momentum)}
											stroke="#ffffff"
											stroke-width="1"
										/>
									{/each}
								{/if}
								
								<!-- X axis date labels (every 5 days) -->
								{#each momentumHistory as point, i}
									{#if i % 5 === 0 || i === momentumHistory.length - 1}
										<text
											x={xScale(i)}
											y={chartHeight + 25}
											text-anchor="middle"
											font-size="10"
											fill="#6b7280" 
										>
											{formatDate(point.date)}
										</text>
									{/if}
								{/each}
								
								<!-- Hover effects -->
								{#if hoveredPoint}
									<line
										x1={hoveredPoint.x}
										y1="0"
										x2={hoveredPoint.x}
										y2={chartHeight}
										stroke="#9ca3af"
										stroke-width="1"
										stroke-dasharray="4 4"
									/>
									
									<circle
										cx={hoveredPoint.x}
										cy={hoveredPoint.y}
										r="6"
										fill={getMomentumColor(hoveredPoint.momentum)}
										stroke="#ffffff"
										stroke-width="2"
									/>
									
									<!-- Improved tooltip -->
									<rect
										x={tooltipX}
										y={tooltipY}
										width="120"
										height="45"
										rx="4"
										fill="#111827"
										opacity="0.95"
									/>
									
									<text
										x={tooltipTextX}
										y={tooltipTextY1}
										text-anchor="middle"
										font-size="12"
										fill="#ffffff"
									>
										{formatDate(hoveredPoint.date)}
									</text>
									
									<text
										x={tooltipTextX}
										y={tooltipTextY2}
										text-anchor="middle"
										font-size="14"
										font-weight="bold"
										fill="#ffffff"
									>
										Momentum: {hoveredPoint.momentum}
									</text>
								{/if}
							</g>
						</svg>
					</div>
				{:else}
					<p class="text-center text-gray-500 py-10">No momentum history available yet.</p>
				{/if}
			</div>
		</div>
		
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			<!-- Daily Habits Summary -->
			<div class="bg-indigo-50 p-4 rounded-lg">
				<h3 class="text-lg font-medium text-indigo-700">Daily Habits</h3>
				<div class="flex flex-col space-y-4 mt-3">
					{#each dailyHabits.slice(0, 3) as habit}
						<div class="bg-white p-3 rounded-md shadow-sm border border-indigo-100">
							<div class="flex justify-between items-center">
								<div class="flex-1">
									<p class="font-medium text-gray-800">{habit.name}</p>
									<div class="flex items-center mt-1">
										<span class={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getMomentumClass(habit.currentMomentum || 0)}`}>
											{habit.currentMomentum || 0}
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
													await invalidate('/dashboard');
													await invalidate('/habits/daily');
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
				</div>
				{#if dailyHabits.length > 3}
					<a href="/habits/daily" class="text-sm font-medium text-indigo-600 hover:text-indigo-900">
						View all {dailyHabits.length} habits →
					</a>
				{:else}
					<a href="/habits/daily" class="text-sm font-medium text-indigo-600 hover:text-indigo-900">
						Manage habits →
					</a>
				{/if}
			</div>
			
			<!-- Weekly Habits Summary -->
			<div class="bg-purple-50 p-4 rounded-lg">
				<div class="flex justify-between items-center mb-3">
					<h3 class="text-lg font-medium text-purple-700">Weekly Habits</h3>
					<a href="/habits/weekly" class="text-xs text-purple-600 hover:text-purple-800 font-medium">
						View All
					</a>
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
											<span class={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getMomentumClass(habit.currentMomentum || 0)}`}>
												{habit.currentMomentum || 0}
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
										style="width: {Math.min(100, (habit.completionsThisWeek / (habit.targetCount || 2)) * 100)}%"
									></div>
								</div>
							</div>
						{/each}
					</div>
					{#if weeklyHabits.length > 3}
						<a href="/habits/weekly" class="text-sm font-medium text-purple-600 hover:text-purple-900">
							View all {weeklyHabits.length} habits →
						</a>
					{:else}
						<a href="/habits/weekly" class="text-sm font-medium text-purple-600 hover:text-purple-900">
							Manage habits →
						</a>
					{/if}
				{/if}
			</div>
		</div>
	</div>
</div>