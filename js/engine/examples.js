/* ==========================================================================
   EXAMPLES.JS - Preset Algorithm & Data Structure Code Samples
   ========================================================================== */

export const PRESET_EXAMPLES = {
    bubbleSort: `// Bubble Sort Algorithm with Array & Pointer Tracking
function bubbleSort(arr) {
    let n = arr.length;
    for (let i = 0; i < n - 1; i++) {
        for (let j = 0; j < n - i - 1; j++) {
            // Compare elements at j and j + 1
            if (arr[j] > arr[j + 1]) {
                // Swap arr[j] and arr[j+1]
                let temp = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = temp;
                console.log("Swapped " + arr[j+1] + " and " + arr[j]);
            }
        }
    }
    return arr;
}

let numbers = [45, 12, 89, 34, 22];
console.log("Initial Array:", numbers);
let sorted = bubbleSort(numbers);
console.log("Sorted Result:", sorted);`,

    quickSort: `// Quick Sort Algorithm with Partitioning Pointers
function quickSort(arr, low = 0, high = arr.length - 1) {
    if (low < high) {
        let pi = partition(arr, low, high);
        quickSort(arr, low, pi - 1);
        quickSort(arr, pi + 1, high);
    }
    return arr;
}

function partition(arr, low, high) {
    let pivot = arr[high];
    let i = low - 1;
    
    for (let j = low; j < high; j++) {
        if (arr[j] < pivot) {
            i++;
            let temp = arr[i];
            arr[i] = arr[j];
            arr[j] = temp;
        }
    }
    let temp = arr[i + 1];
    arr[i + 1] = arr[high];
    arr[high] = temp;
    return i + 1;
}

let data = [38, 27, 43, 3, 9, 82];
console.log("Sorting array:", data);
quickSort(data);
console.log("QuickSorted:", data);`,

    binarySearch: `// Binary Search Visualizer
function binarySearch(arr, target) {
    let left = 0;
    let right = arr.length - 1;
    
    while (left <= right) {
        let mid = Math.floor((left + right) / 2);
        console.log("Checking index " + mid + " value: " + arr[mid]);
        
        if (arr[mid] === target) {
            console.log("Found target " + target + " at index " + mid);
            return mid;
        }
        if (arr[mid] < target) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }
    return -1;
}

let sortedArr = [10, 20, 30, 40, 50, 60, 70, 80];
let searchKey = 50;
let index = binarySearch(sortedArr, searchKey);`,

    recursionFib: `// Fibonacci Sequence with Recursive Call Stack
function fibonacci(n) {
    if (n <= 1) {
        return n;
    }
    console.log("Calculating fib(" + n + ")");
    let a = fibonacci(n - 1);
    let b = fibonacci(n - 2);
    let result = a + b;
    return result;
}

let num = 4;
let fibResult = fibonacci(num);
console.log("Fibonacci(" + num + ") =", fibResult);`,

    factorialStack: `// Factorial Call Stack Visualizer
function factorial(n) {
    if (n === 1) {
        console.log("Base case reached: n = 1");
        return 1;
    }
    console.log("Stacking factorial(" + n + ")");
    let result = n * factorial(n - 1);
    console.log("Returning " + result + " for factorial(" + n + ")");
    return result;
}

let ans = factorial(5);
console.log("Factorial(5) =", ans);`,

    eventLoopAsync: `// Promises vs setTimeout Event Loop Visualizer
console.log("1. Start script execution");

setTimeout(function timeoutTask() {
    console.log("4. Task Queue (setTimeout callback executed)");
}, 0);

Promise.resolve().then(function microtaskTask() {
    console.log("3. Microtask Queue (Promise resolved callback)");
});

console.log("2. End script execution");`,

    asyncAwait: `// Async / Await Microtask Queue Visualizer
async function fetchUserData() {
    console.log("Inside async function: before await");
    let data = await Promise.resolve({ id: 101, user: "Alice" });
    console.log("Inside async function: after await", data);
    return data;
}

console.log("Script start");
fetchUserData();
console.log("Script end");`,

    closures: `// Lexical Closures & Heap Memory References
function createCounter(initialValue) {
    let count = initialValue;
    
    return {
        increment: function() {
            count++;
            console.log("Count increased to:", count);
            return count;
        },
        decrement: function() {
            count--;
            console.log("Count decreased to:", count);
            return count;
        }
    };
}

let counterA = createCounter(10);
counterA.increment();
counterA.increment();
counterA.decrement();`,

    heapReferences: `// Object References & Shared Heap Memory
let person1 = { name: "Harsh", age: 24 };
let person2 = person1; // Reference copy (points to same object)

console.log("person1 name:", person1.name);
person2.age = 25; // Mutates shared object in heap!
console.log("person1 age updated:", person1.age);

let team = {
    leader: person1,
    members: ["Alice", "Bob"]
};
console.log("Team details:", team);`,

    bstTree: `// Binary Search Tree Node Graph Visualizer
class TreeNode {
    constructor(val) {
        this.val = val;
        this.left = null;
        this.right = null;
    }
}

function insertNode(root, val) {
    if (!root) return new TreeNode(val);
    if (val < root.val) {
        root.left = insertNode(root.left, val);
    } else {
        root.right = insertNode(root.right, val);
    }
    return root;
}

let root = new TreeNode(50);
insertNode(root, 30);
insertNode(root, 70);
insertNode(root, 20);
insertNode(root, 40);
console.log("BST Root Node:", root);`
};
