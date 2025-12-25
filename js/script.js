// Stockify Pro AI - Interactive Features

document.addEventListener('DOMContentLoaded', function () {
    // Smooth scrolling for navigation links
    initSmoothScroll();

    // Header scroll effect
    initHeaderScroll();

    // Animate elements on scroll
    initScrollAnimations();

    // Initialize counters animation
    initCounters();

    // VIX meter animation
    animateVixMeter();

    // Allocation bars animation
    animateAllocationBars();
});

// Smooth scroll for navigation
function initSmoothScroll() {
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);

            if (targetSection) {
                const headerHeight = document.querySelector('.header').offsetHeight;
                const targetPosition = targetSection.offsetTop - headerHeight;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Header background on scroll
function initHeaderScroll() {
    const header = document.querySelector('.header');
    let lastScroll = 0;

    window.addEventListener('scroll', function () {
        const currentScroll = window.pageYOffset;

        if (currentScroll > 50) {
            header.style.background = 'rgba(10, 10, 15, 0.95)';
            header.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
        } else {
            header.style.background = 'rgba(10, 10, 15, 0.85)';
            header.style.boxShadow = 'none';
        }

        lastScroll = currentScroll;
    });
}

// Scroll animations using Intersection Observer
function initScrollAnimations() {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');

                // Trigger specific animations
                if (entry.target.classList.contains('risk-card')) {
                    animateRiskMeter(entry.target);
                }
            }
        });
    }, observerOptions);

    // Observe all animated elements
    const animatedElements = document.querySelectorAll(
        '.summary-card, .macro-card, .region-card, .sector-card, .risk-card, .blackswan-card, .indicator-card, .allocation-item'
    );

    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        observer.observe(el);
    });
}

// Animate risk meters when visible
function animateRiskMeter(card) {
    const meter = card.querySelector('.meter-fill');
    if (meter) {
        const width = meter.style.width;
        meter.style.width = '0%';

        setTimeout(() => {
            meter.style.transition = 'width 1s ease-out';
            meter.style.width = width;
        }, 100);
    }
}

// VIX meter animation
function animateVixMeter() {
    const vixIndicator = document.querySelector('.vix-indicator');
    if (vixIndicator) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    vixIndicator.style.transition = 'left 1.5s ease-out';
                    vixIndicator.style.left = '20%';
                }
            });
        }, { threshold: 0.5 });

        const vixSection = document.querySelector('.vix-section');
        if (vixSection) {
            vixIndicator.style.left = '0%';
            observer.observe(vixSection);
        }
    }
}

// Allocation bars animation
function animateAllocationBars() {
    const allocationItems = document.querySelectorAll('.allocation-item');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const barFill = entry.target.querySelector('.bar-fill');
                if (barFill) {
                    const width = barFill.style.width;
                    barFill.style.width = '0%';

                    setTimeout(() => {
                        barFill.style.transition = 'width 1s ease-out';
                        barFill.style.width = width;
                    }, 200);
                }
            }
        });
    }, { threshold: 0.5 });

    allocationItems.forEach(item => observer.observe(item));
}

// Counter animation (for future use)
function initCounters() {
    // Could be used for animating numbers like VIX value, indices, etc.
    const counters = document.querySelectorAll('[data-counter]');

    counters.forEach(counter => {
        const target = parseInt(counter.dataset.counter);
        const duration = 2000;
        const step = target / (duration / 16);
        let current = 0;

        const animate = () => {
            current += step;
            if (current < target) {
                counter.textContent = Math.floor(current).toLocaleString();
                requestAnimationFrame(animate);
            } else {
                counter.textContent = target.toLocaleString();
            }
        };

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                animate();
                observer.disconnect();
            }
        });

        observer.observe(counter);
    });
}

// Add animate-in class styles dynamically
const style = document.createElement('style');
style.textContent = `
    .animate-in {
        opacity: 1 !important;
        transform: translateY(0) !important;
        transition: opacity 0.6s ease, transform 0.6s ease;
    }
`;
document.head.appendChild(style);

// Parallax effect for hero background
window.addEventListener('scroll', function () {
    const hero = document.querySelector('.hero-bg');
    if (hero) {
        const scrolled = window.pageYOffset;
        hero.style.transform = `translateY(${scrolled * 0.3}px)`;
    }
});

// Add hover effects to cards
document.querySelectorAll('.summary-card, .macro-card, .region-card, .sector-card').forEach(card => {
    card.addEventListener('mouseenter', function () {
        this.style.transform = 'translateY(-4px)';
    });

    card.addEventListener('mouseleave', function () {
        this.style.transform = 'translateY(0)';
    });
});

// Mobile menu toggle (for future implementation)
function toggleMobileMenu() {
    const navLinks = document.querySelector('.nav-links');
    navLinks.classList.toggle('active');
}

// Print-friendly mode
function enablePrintMode() {
    document.body.classList.add('print-mode');
    window.print();
    document.body.classList.remove('print-mode');
}

// Export to PDF functionality placeholder
function exportToPDF() {
    // Could integrate with html2pdf or similar library
    console.log('PDF export functionality can be added with html2pdf library');
}

console.log('Stockify Pro AI - Market Outlook Report Loaded Successfully');
