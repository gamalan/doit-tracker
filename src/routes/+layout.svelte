<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { signOut } from '@auth/sveltekit/client';
	import { onMount } from 'svelte';
	
	let isDropdownOpen = false;
	let dropdownRef;

	$: session = $page.data.session;
	
	// Toggle dropdown
	function toggleDropdown() {
		isDropdownOpen = !isDropdownOpen;
	}
	
	// Handle clicking outside the dropdown to close it
	function handleClickOutside(event) {
		if (dropdownRef && !dropdownRef.contains(event.target) && isDropdownOpen) {
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

				<div class="flex items-center space-x-4">
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
		</nav>
	</header>

	<main class="flex-grow">
		<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
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
