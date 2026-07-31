/* ==========================================================================
   EDUCATIONAL.JS - Concept Explainers & Tooltips
   ========================================================================== */

const EDUCATIONAL_CONTENT = {
    'call-stack': {
        title: 'The Call Stack',
        content: `
            <p>The <strong>Call Stack</strong> is how JavaScript keeps track of what function is currently running. It works on a <strong>Last-In, First-Out (LIFO)</strong> principle.</p>
            <div class="highlight-box">
                <i class="fa-solid fa-arrow-down"></i> <strong>Top to Bottom:</strong> When you call a function, it is "pushed" to the TOP of the stack. When it finishes returning, it is "popped" off. The function at the very top is the one actively executing!
            </div>
            <p>In recursive algorithms like Merge Sort, you will see many frames of the same function stack up as it dives deeper into sub-problems before returning.</p>
        `
    },
    'heap': {
        title: 'Memory Heap & References',
        content: `
            <p>The <strong>Memory Heap</strong> is where JavaScript stores complex data structures like Arrays and Objects.</p>
            <div class="highlight-box">
                <i class="fa-solid fa-link"></i> <strong>Pass by Reference:</strong> Variables in the Call Stack don't store the actual Array data. Instead, they store a "pointer" (reference) to a memory address in the Heap.
            </div>
            <p>If multiple variables point to the same address, modifying the array through one variable will affect the other!</p>
        `
    },
    'scope': {
        title: 'Variable Scope',
        content: `
            <p><strong>Scope</strong> determines which variables are accessible at any given line of code.</p>
            <div class="highlight-box">
                <i class="fa-solid fa-lock"></i> <strong>Local Scope:</strong> Variables declared inside a function (using <code>const</code>, <code>let</code>, or <code>var</code>) belong only to that specific function execution frame.
            </div>
            <p>When a function finishes and is removed from the Call Stack, its Local Scope is destroyed, freeing up memory.</p>
        `
    }
};

export function initEducationalTooltips() {
    const tooltips = document.querySelectorAll('.edu-tooltip');
    const modal = document.getElementById('edu-modal');
    const closeBtn = document.getElementById('edu-modal-close');
    const titleText = document.getElementById('edu-modal-title-text');
    const contentBox = document.getElementById('edu-modal-content');

    if (!modal) return;

    tooltips.forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent other click handlers
            const topic = icon.getAttribute('data-topic');
            const data = EDUCATIONAL_CONTENT[topic];

            if (data) {
                titleText.textContent = data.title;
                contentBox.innerHTML = data.content;
                modal.classList.remove('hidden');
            }
        });
    });

    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    // Close on clicking overlay background
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });
}
