// ============================================================
// Sample Test Data — used for "Try Sample Test" feature
// ============================================================
import type { TestData } from '../types';

export const sampleTestData: TestData = {
  title: "Abhiyantra GATE CS — Sample Mock Test",
  subject: "Computer Science & IT",
  topic: "Full Syllabus Practice",
  description: "Official Abhiyantra practice test covering MCQ, MSQ, and NAT question formats following the GATE pattern.",
  questions: [
    {
      id: 1,
      type: "MCQ",
      marks: 1,
      subject: "Data Structures",
      topic: "Stacks & Queues",
      question: "Which data structure uses LIFO (Last In, First Out) ordering?",
      options: ["Queue", "Stack", "Linked List", "Binary Tree"],
      answer: 1,
      solution: "A Stack follows Last In, First Out (LIFO), where the most recently pushed element is popped first. Queues follow FIFO."
    },
    {
      id: 2,
      type: "MCQ",
      marks: 1,
      subject: "Algorithms",
      topic: "Searching Algorithms",
      question: "What is the time complexity of binary search on a sorted array of n elements?",
      options: ["O(n)", "O(log n)", "O(n log n)", "O(1)"],
      answer: 1,
      solution: "Binary search repeatedly divides the search interval in half, giving O(log n) time complexity."
    },
    {
      id: 3,
      type: "MCQ",
      marks: 2,
      subject: "Data Structures",
      topic: "Binary Search Trees",
      question: "Which of the following is NOT a valid property of a Binary Search Tree (BST)?",
      options: [
        "Left subtree values are less than root",
        "Right subtree values are greater than root",
        "Both subtrees are also BSTs",
        "Every node has exactly two children"
      ],
      answer: 3,
      solution: "A BST does not require every node to have exactly two children. Nodes can have 0, 1, or 2 children. The other three properties define a valid BST."
    },
    {
      id: 4,
      type: "MCQ",
      marks: 2,
      subject: "Operating Systems",
      topic: "Memory Management & Paging",
      question: "In a paging system with page size of 4KB and 32-bit logical address, how many bits are needed for the page offset?",
      options: ["10", "11", "12", "13"],
      answer: 2,
      solution: "Page size = 4KB = 2^12 bytes, so 12 bits are needed for the page offset."
    },
    {
      id: 5,
      type: "MSQ",
      marks: 2,
      subject: "Algorithms",
      topic: "Sorting Algorithms",
      question: "Which of the following sorting algorithms have O(n log n) worst-case time complexity?",
      options: ["Merge Sort", "Quick Sort", "Heap Sort", "Bubble Sort"],
      answer: [0, 2],
      solution: "Merge Sort and Heap Sort guarantee O(n log n) in the worst case. Quick Sort degrades to O(n²) in the worst case, and Bubble Sort is O(n²)."
    },
    {
      id: 6,
      type: "MSQ",
      marks: 1,
      subject: "Data Structures",
      topic: "Tree Traversals",
      question: "Which of the following are valid traversal methods for a binary tree?",
      options: ["Inorder", "Preorder", "Postorder", "Random-order"],
      answer: [0, 1, 2],
      solution: "Inorder, Preorder, and Postorder are the three standard depth-first traversal methods. 'Random-order' is not a standard traversal."
    },
    {
      id: 7,
      type: "NAT",
      marks: 2,
      subject: "Engineering Mathematics",
      topic: "Numerical Computation",
      question: "What is the value of 15 / 4? (Round to two decimal places)",
      answer: { min: 3.74, max: 3.76 },
      solution: "15 divided by 4 equals 3.75, which falls within the accepted range [3.74, 3.76]."
    },
    {
      id: 8,
      type: "NAT",
      marks: 1,
      subject: "Data Structures",
      topic: "Binary Trees",
      question: "A complete binary tree has 31 nodes. How many leaf nodes does it have?",
      answer: 16,
      solution: "In a complete binary tree with n nodes, the number of leaf nodes is ⌈n/2⌉ = ⌈31/2⌉ = 16."
    },
    {
      id: 9,
      type: "MCQ",
      marks: 1,
      subject: "Computer Networks",
      topic: "OSI Reference Model",
      question: "Which layer of the OSI model is responsible for routing?",
      options: ["Data Link Layer", "Transport Layer", "Network Layer", "Session Layer"],
      answer: 2,
      solution: "The Network Layer (Layer 3) handles routing of packets between different networks using IP addresses."
    },
    {
      id: 10,
      type: "NAT",
      marks: 2,
      subject: "Operating Systems",
      topic: "Virtual Memory & Page Replacement",
      question: "Consider a process with 5 pages and 3 frames using LRU page replacement. The page reference string is: 1, 2, 3, 4, 1, 2, 5, 1, 2, 3. How many page faults occur?",
      answer: 8,
      solution: "Tracing through LRU: Frames start empty. 1(fault), 2(fault), 3(fault), 4(fault,evict 1), 1(fault,evict 2), 2(fault,evict 3), 5(fault,evict 4), 1(hit), 2(hit), 3(fault,evict 5). Total = 8 page faults."
    }
  ]
};

export const sampleJSONString = JSON.stringify(sampleTestData, null, 2);
