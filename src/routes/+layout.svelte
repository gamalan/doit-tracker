<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { signOut } from '@auth/sveltekit/client';
	import { onMount } from 'svelte';
	
	let isDropdownOpen = false;
	let isMobileMenuOpen = false;
	let dropdownRef: HTMLDivElement;

	$: session = $page.data.session;
	
	// Toggle dropdown
	function toggleDropdown() {
		isDropdownOpen = !isDropdownOpen;
	}
	
	// Toggle mobile menu
	function toggleMobileMenu() {
		isMobileMenuOpen = !isMobileMenuOpen;
	}
	
	// Handle clicking outside the dropdown to close it
	function handleClickOutside(event: MouseEvent) {
		if (dropdownRef && !dropdownRef.contains(event.target as Node) && isDropdownOpen) {
			isDropdownOpen = false;
		}
	}

	// Setup click outside handler
	onMount(() => {
		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	});

	function handleSignOut() {
		isDropdownOpen = false;
		signOut();
	}
</script>

<div class="flex min-h-screen flex-col">
	<header class="bg-indigo-600 shadow-lg">
		<nav class="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
			<div class="flex items-center justify-between">
				<div class="flex items-center">
					<a href="/" class="transition-opacity hover:opacity-90">
						<span class="text-xl font-bold text-white">DoIt Tracker</span>
					</a>
				</div>

				<!-- Mobile menu button -->
				<div class="md:hidden flex items-center">
					{#if session}
						<a href="/dashboard" class="mr-3 p-2 text-white hover:text-indigo-100 flex items-center justify-center">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
							</svg>
							<span class="sr-only">Dashboard</span>
						</a>
					{/if}
					<button 
						type="button" 
						class="inline-flex items-center justify-center p-2 rounded-md text-white hover:text-indigo-100 focus:outline-none"
						on:click={toggleMobileMenu}
					>
						<span class="sr-only">{isMobileMenuOpen ? 'Close menu' : 'Open menu'}</span>
						<svg 
							class="h-6 w-6" 
							xmlns="http://www.w3.org/2000/svg" 
							fill="none" 
							viewBox="0 0 24 24" 
							stroke="currentColor"
						>
							{#if isMobileMenuOpen}
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							{:else}
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
							{/if}
						</svg>
					</button>
				</div>

				<!-- Desktop navigation -->
				<div class="hidden md:flex items-center space-x-4">
					{#if session}
						<a href="/dashboard" class="text-white hover:text-indigo-100">Dashboard</a>
						<a href="/habits/daily" class="text-white hover:text-indigo-100">Daily Habits</a>
						<a href="/habits/weekly" class="text-white hover:text-indigo-100">Weekly Habits</a>
						<div class="relative ml-3" bind:this={dropdownRef}>
							<button
								type="button"
								class="flex items-center rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-white"
								id="user-menu-button"
								aria-expanded={isDropdownOpen}
								aria-haspopup="true"
								on:click={toggleDropdown}
							>
								<span class="sr-only">Open user menu</span>
								{#if session?.user?.image}
									<img
										class="h-8 w-8 rounded-full"
										src={session.user.image}
										alt={session.user.name || ''}
									/>
								{:else}
									<div
										class="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-300 text-indigo-800"
									>
										{session?.user?.name?.[0] || session?.user?.email?.[0] || '?'}
									</div>
								{/if}
								<span class="ml-2 text-white">{session?.user?.name || session?.user?.email}</span>
								<svg class="ml-1 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
									<path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
								</svg>
							</button>
							
							{#if isDropdownOpen}
								<div 
									class="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none" 
									role="menu" 
									aria-orientation="vertical" 
									aria-labelledby="user-menu-button"
									tabindex="-1"
								>
									<div class="block px-4 py-2 text-sm text-gray-700 border-b border-gray-200">
										<span class="font-medium">Signed in as</span>
										<div class="truncate">{session?.user?.email}</div>
									</div>
									<button
										on:click={handleSignOut}
										class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-red-600"
										role="menuitem"
									>
										Sign out
									</button>
								</div>
							{/if}
						</div>
					{:else}
						<a href="/login" class="text-white hover:text-indigo-100">Sign in</a>
					{/if}
				</div>
			</div>
			
			<!-- Mobile menu, show/hide based on menu state -->
			{#if isMobileMenuOpen}
				<div class="md:hidden pt-4 pb-3 border-t border-indigo-500 mt-3">
					{#if session}
						<div class="space-y-1 px-2">
							<a href="/dashboard" class="block px-3 py-2 rounded-md text-base font-medium text-white hover:bg-indigo-500">Dashboard</a>
							<a href="/habits/daily" class="block px-3 py-2 rounded-md text-base font-medium text-white hover:bg-indigo-500">Daily Habits</a>
							<a href="/habits/weekly" class="block px-3 py-2 rounded-md text-base font-medium text-white hover:bg-indigo-500">Weekly Habits</a>
						</div>
						<div class="border-t border-indigo-500 pt-4 pb-3 mt-3">
							<div class="flex items-center px-3">
								{#if session?.user?.image}
									<div class="flex-shrink-0">
										<img class="h-10 w-10 rounded-full" src={session.user.image} alt="" />
									</div>
								{:else}
									<div class="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-300 text-indigo-800">
										{session?.user?.name?.[0] || session?.user?.email?.[0] || '?'}
									</div>
								{/if}
								<div class="ml-3">
									<div class="text-base font-medium text-white">{session?.user?.name || 'User'}</div>
									<div class="text-sm font-medium text-indigo-200">{session?.user?.email}</div>
								</div>
							</div>
							<div class="mt-3 space-y-1 px-2">
								<button
									on:click={handleSignOut}
									class="block w-full text-left rounded-md px-3 py-2 text-base font-medium text-white hover:bg-indigo-500"
								>
									Sign out
								</button>
							</div>
						</div>
					{:else}
						<div class="space-y-1 px-2">
							<a href="/login" class="block px-3 py-2 rounded-md text-base font-medium text-white hover:bg-indigo-500">Sign in</a>
						</div>
					{/if}
				</div>
			{/if}
		</nav>
	</header>

	<main class="flex-grow">
		<div class="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
			<slot />
		</div>
	</main>

	<footer class="border-t border-gray-200 bg-gray-100">
		<div class="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
			<div class="flex flex-col md:flex-row justify-between items-center">
				<p class="text-sm text-gray-500">
					© {new Date().getFullYear()} DoIt Tracker - A guilt-free habit tracker
				</p>
				<div class="mt-2 md:mt-0">
					<a href="https://utas.me/barebearfoot-gan" class="text-indigo-600 hover:text-indigo-800 text-sm font-medium" target="_blank" rel="noopener noreferrer">
						Contact
					</a>
				</div>
			</div>
		</div>
	</footer>
</div>
