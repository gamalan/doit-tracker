<script>
  import { page } from '$app/stores';
  
  // Check if the user is already logged in
  $: session = $page.data.session;
</script>

<svelte:head>
  <title>DoIt Tracker - A guilt-free habit tracker with momentum-based scoring</title>
  <meta name="description" content="Build lasting habits with DoIt Tracker's momentum system. Track daily and weekly habits, get rewarded for consistency, and forgive occasional misses. Focus on progress, not perfection." />
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://doit.empat.id/" />
  <meta property="og:title" content="DoIt Tracker - A guilt-free habit tracker" />
  <meta property="og:description" content="Build lasting habits with our momentum system. Track daily and weekly habits, get rewarded for consistency, and forgive occasional misses." />
  <meta property="og:image" content="https://doit.empat.id/og-image.svg" />
  
  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image" />
  <meta property="twitter:url" content="https://doit.empat.id/" />
  <meta property="twitter:title" content="DoIt Tracker - A guilt-free habit tracker" />
  <meta property="twitter:description" content="Build lasting habits with our momentum system. Track daily and weekly habits, get rewarded for consistency, and forgive occasional misses." />
  <meta property="twitter:image" content="https://doit.empat.id/og-image.svg" />
  
  <!-- Additional SEO -->
  <meta name="keywords" content="habit tracker, momentum scoring, daily habits, weekly habits, productivity, self-improvement, goal tracking, habit building" />
  <meta name="author" content="DoIt Tracker" />
  <link rel="canonical" href="https://doit.empat.id/" />
</svelte:head>

<div class="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
  <!-- Hero Section -->
  <section class="pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
    <div class="text-center">
      <h1 class="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight">
        <a href="/" class="hover:opacity-90 transition-opacity">
          <span class="block">DoIt Tracker</span>
          <span class="block text-indigo-600 mt-2">A guilt-free way to build habits</span>
        </a>
      </h1>
      <p class="mt-6 text-xl text-gray-500 max-w-3xl mx-auto">
        Focus on progress, not perfection. Build lasting habits with a momentum system that rewards consistency and forgives occasional misses.
      </p>
      <div class="mt-10">
        {#if session}
          <a href="/dashboard" class="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
            Go to Dashboard
          </a>
        {:else}
          <a href="/login" class="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
            Get Started
          </a>
        {/if}
        <a href="#features" class="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 ml-3">
          Learn more
        </a>
      </div>
    </div>
  </section>

  <!-- Features Section -->
  <section id="features" class="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
    <h2 class="text-3xl font-extrabold text-gray-900 text-center mb-12">Key Features</h2>
    
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      <!-- Daily Habits Feature -->
      <div class="bg-white p-6 rounded-lg shadow-md border border-gray-100">
        <div class="bg-indigo-100 rounded-full w-12 h-12 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-gray-900 mb-2">Daily Habits</h3>
        <p class="text-gray-600">
          Build a daily routine with habits that reward consistency. Each completion adds to your momentum score, creating positive reinforcement.
        </p>
        <ul class="mt-4 space-y-2 text-sm text-gray-600">
          <li class="flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            Gain +1 momentum for each completion
          </li>
          <li class="flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            Build streaks for bonus momentum
          </li>
          <li class="flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            Maximum +30 momentum per habit
          </li>
        </ul>
      </div>

      <!-- Weekly Habits Feature -->
      <div class="bg-white p-6 rounded-lg shadow-md border border-gray-100">
        <div class="bg-purple-100 rounded-full w-12 h-12 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-gray-900 mb-2">Weekly Habits</h3>
        <p class="text-gray-600">
          Set flexible weekly goals with minimum targets. Perfect for habits that don't need to be done every single day.
        </p>
        <ul class="mt-4 space-y-2 text-sm text-gray-600">
          <li class="flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            +1 momentum per tracking
          </li>
          <li class="flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            +10 bonus when reaching weekly minimum
          </li>
          <li class="flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            Up to +40 momentum with consecutive successes
          </li>
        </ul>
      </div>

      <!-- Guilt-Free System Feature -->
      <div class="bg-white p-6 rounded-lg shadow-md border border-gray-100">
        <div class="bg-green-100 rounded-full w-12 h-12 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-gray-900 mb-2">Guilt-Free System</h3>
        <p class="text-gray-600">
          Life happens. Our momentum system encourages consistency without punishing the occasional miss too harshly.
        </p>
        <ul class="mt-4 space-y-2 text-sm text-gray-600">
          <li class="flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            Focus on overall progress, not perfection
          </li>
          <li class="flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            Reasonable penalties for missed habits
          </li>
          <li class="flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            Quick recovery from occasional setbacks
          </li>
        </ul>
      </div>
    </div>
  </section>

  <!-- How It Works -->
  <section class="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-gray-50 rounded-lg">
    <h2 class="text-3xl font-extrabold text-gray-900 text-center mb-12">How It Works</h2>
    
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div class="text-center">
        <div class="bg-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-md">
          <span class="text-2xl font-bold text-indigo-600">1</span>
        </div>
        <h3 class="text-xl font-medium text-gray-900 mb-2">Create Your Habits</h3>
        <p class="text-gray-600">Choose between daily or weekly habits and set your goals.</p>
      </div>
      
      <div class="text-center">
        <div class="bg-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-md">
          <span class="text-2xl font-bold text-indigo-600">2</span>
        </div>
        <h3 class="text-xl font-medium text-gray-900 mb-2">Track Consistently</h3>
        <p class="text-gray-600">Check in regularly to mark your habits as complete.</p>
      </div>
      
      <div class="text-center">
        <div class="bg-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-md">
          <span class="text-2xl font-bold text-indigo-600">3</span>
        </div>
        <h3 class="text-xl font-medium text-gray-900 mb-2">Build Momentum</h3>
        <p class="text-gray-600">Watch your momentum score grow as you develop lasting habits.</p>
      </div>
    </div>
    
    <div class="text-center mt-12">
      {#if !session}
        <a href="/login" class="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
          Start Building Better Habits
        </a>
      {/if}
    </div>
  </section>
</div>
