<script lang="ts">
	import { page } from '$app/stores';
</script>

<svelte:head>
	<title>Privacy Policy - DoIt Tracker</title>
	<meta name="description" content="Privacy Policy for DoIt Tracker - A guilt-free habit tracker" />
</svelte:head>

<div class="max-w-3xl mx-auto">
	<h1 class="text-3xl font-bold mb-6">Privacy Policy</h1>
	
	<div class="prose max-w-none">
		<p class="mb-4">Last updated: {new Date().toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric'})}</p>

		<h2 class="text-xl font-semibold mt-6 mb-3">1. Introduction</h2>
		<p>This Privacy Policy explains how DoIt Tracker ("we," "our," or "us") collects, uses, and discloses your information when you use our habit tracking service. Please read this Privacy Policy carefully.</p>

		<h2 class="text-xl font-semibold mt-6 mb-3">2. Information We Collect</h2>
		<p>We collect several types of information from and about users of our Service:</p>
		<ul class="list-disc pl-6 mb-4">
			<li>Account Information: When you sign up, we collect information such as your name, email address, and profile picture through Google Sign-In.</li>
			<li>Usage Data: We collect information about how you interact with our Service, including habits you create and track.</li>
			<li>Log and Device Information: We may collect information about your browser, operating system, IP address, and device identifiers.</li>
		</ul>

		<h2 class="text-xl font-semibold mt-6 mb-3">3. How We Use Your Information</h2>
		<p>We use the information we collect to:</p>
		<ul class="list-disc pl-6 mb-4">
			<li>Provide, maintain, and improve our Service</li>
			<li>Process and complete transactions</li>
			<li>Send you technical notices, updates, security alerts, and support messages</li>
			<li>Monitor and analyze usage patterns</li>
			<li>Personalize your experience</li>
		</ul>

		<h2 class="text-xl font-semibold mt-6 mb-3">4. How We Share Your Information</h2>
		<p>We do not sell your personal information. We may share your information in the following circumstances:</p>
		<ul class="list-disc pl-6 mb-4">
			<li>With service providers who perform services on our behalf</li>
			<li>If required by law or legal process</li>
			<li>If we believe disclosure is necessary to protect our rights, property, or safety</li>
			<li>In connection with a merger, sale, or acquisition</li>
		</ul>

		<h2 class="text-xl font-semibold mt-6 mb-3">5. Data Security</h2>
		<p>We implement reasonable measures to help protect your information from loss, theft, misuse, and unauthorized access. However, no internet transmission is completely secure.</p>

		<h2 class="text-xl font-semibold mt-6 mb-3">6. Your Choices</h2>
		<p>You can access, update, or delete your account information at any time. You may also request a copy of your data or ask us to delete your account entirely.</p>

		<h2 class="text-xl font-semibold mt-6 mb-3">7. Children's Privacy</h2>
		<p>Our Service is not intended for children under 13, and we do not knowingly collect personal information from children under 13.</p>

		<h2 class="text-xl font-semibold mt-6 mb-3">8. Changes to Our Privacy Policy</h2>
		<p>We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.</p>

		<h2 class="text-xl font-semibold mt-6 mb-3">9. Contact Us</h2>
		<p>If you have any questions about this Privacy Policy, please <a href="https://utas.me/barebearfoot-gan" class="text-indigo-600 hover:text-indigo-800" target="_blank" rel="noopener noreferrer">contact us</a>.</p>
	</div>
</div>