/**
 * Checkout page logic
 * Handles form validation, stepper updates, and mobile stacking
 */

export async function initCheckout() {
    VX.cart();

    // Mobile: when form shows, ensure proper stacking
    var cf = VX.$('cf');
    if (cf) {
        var observer = new MutationObserver(function() {
            if (cf.style.display !== 'none') {
                var grid = VX.$('checkoutGrid');
                if (grid && window.innerWidth < 768) {
                    grid.style.gridTemplateColumns = '1fr';
                }
            }
        });
        observer.observe(cf, { attributes: true, attributeFilter: ['style'] });
    }

    // Initialize stepper functionality
    initStepper();

    // Listen for successful order registration to advance to step 3
    window.addEventListener('vx:order-complete', function() {
        updateStepper(3);
        // Scroll to confirmation on mobile
        if (window.innerWidth < 768) {
            var confirmation = document.querySelector('.order-confirmation');
            if (confirmation) confirmation.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
}

function initStepper() {
    var cf = VX.$('cf');
    if (!cf) return;

    var observer = new MutationObserver(function() {
        if (cf.style.display !== 'none') {
            updateStepper(2); // Step 2 active when form is visible
        } else {
            updateStepper(1); // Step 1 when form hidden
        }
    });
    observer.observe(cf, { attributes: true, attributeFilter: ['style'] });

    // Initial state
    if (cf.style.display !== 'none') {
        updateStepper(2);
    }
}

function updateStepper(step) {
    var steps = document.querySelectorAll('.stepper-step');
    steps.forEach(function(stepEl, index) {
        var stepNum = index + 1;
        stepEl.classList.remove('active', 'completed');

        if (stepNum < step) {
            stepEl.classList.add('completed');
        } else if (stepNum === step) {
            stepEl.classList.add('active');
        }
    });
}

// Make available globally for backward compatibility
window.initCheckout = initCheckout;