// ============================================================
// Sample Test Data — used for "Try Sample Test" feature
// Demonstrates LaTeX Math, Fenced Code, TikZ Diagrams, and Sections
// ============================================================
import type { TestData } from '../types';

export const sampleTestData: TestData = {
  title: "Abhiyantra GATE CS — Official Sample Mock Test",
  subject: "Computer Science & IT",
  topic: "Full Syllabus Practice with Math & Visuals",
  description: "Official Abhiyantra GATE practice test covering LaTeX mathematical notation, code syntax highlighting, client-side TikZ diagrams, and official CBT sectional switching.",
  sections: [
    { id: "GA", name: "Section 1: General Aptitude", questionCount: 2, marks: 3 },
    { id: "SUBJECT", name: "Section 2: Computer Science & IT", questionCount: 8, marks: 13 }
  ],
  questions: [
    {
      id: 1,
      section: "GA",
      type: "MCQ",
      marks: 1,
      subject: "General Aptitude",
      topic: "Quantitative Aptitude",
      question: "If the quadratic function is given by $f(x) = x^2 - 4x + 7$, what is the minimum value of $f(x)$ for all real numbers $x \\in \\mathbb{R}$?",
      options: ["1", "2", "3", "7"],
      answer: 2,
      solution: "By completing the square:\n$$f(x) = (x - 2)^2 + 3$$\nSince $(x - 2)^2 \\ge 0$, the minimum value is $3$, achieved at $x = 2$."
    },
    {
      id: 2,
      section: "GA",
      type: "NAT",
      marks: 2,
      subject: "General Aptitude",
      topic: "Analytical Reasoning",
      question: "In a class of 60 students, 40 study Mathematics, 30 study Physics, and 20 study both. How many students study neither Mathematics nor Physics?",
      answer: 10,
      solution: "Using the principle of inclusion-exclusion:\n$$|M \\cup P| = |M| + |P| - |M \\cap P| = 40 + 30 - 20 = 50$$\nNeither $= 60 - 50 = 10$ students."
    },
    {
      id: 3,
      section: "SUBJECT",
      type: "MCQ",
      marks: 1,
      subject: "Engineering Mathematics",
      topic: "Calculus & Integration",
      question: "Evaluate the following definite integral:\n$$\\int_{0}^{\\pi/2} \\sin(x) \\cos(x) \\, dx$$",
      options: ["1/4", "1/2", "1", "0"],
      answer: 1,
      solution: "Let $u = \\sin(x) \\implies du = \\cos(x) \\, dx$.\nWhen $x = 0, u = 0$; when $x = \\pi/2, u = 1$.\n$$\\int_{0}^{1} u \\, du = \\left[ \\frac{u^2}{2} \\right]_{0}^{1} = \\frac{1}{2}$$\nHence, the correct option is **1/2**."
    },
    {
      id: 4,
      section: "SUBJECT",
      type: "MCQ",
      marks: 2,
      subject: "Programming & Data Structures",
      topic: "C Programming & Operators",
      question: "What is the output printed by the following standard C program?\n\n```c\n#include <stdio.h>\n\nint main() {\n    int a = 11, b = 4;\n    int res = (a % b) + (a / b);\n    printf(\"Result = %d\\n\", res);\n    return 0;\n}\n```",
      options: ["Result = 3", "Result = 5", "Result = 6", "Compilation Error"],
      answer: 1,
      solution: "Integer division and modulus operations in C:\n- `a % b = 11 % 4 = 3` (remainder)\n- `a / b = 11 / 4 = 2` (integer quotient truncation)\n- `res = 3 + 2 = 5`\nThus, the program prints `Result = 5`."
    },
    {
      id: 5,
      section: "SUBJECT",
      type: "MCQ",
      marks: 2,
      subject: "Theory of Computation",
      topic: "Finite Automata & Graph Representations",
      tikzCode: "\\begin{tikzpicture}[->, >=stealth, node distance=2.5cm, every state/.style={thick, fill=blue!10}, auto]\n  \\node[state, initial] (q0) {$q_0$};\n  \\node[state, accepting] (q1) [right of=q0] {$q_1$};\n  \\path (q0) edge [loop above] node {0} (q0)\n             edge [bend left]  node {1} (q1)\n        (q1) edge [bend left]  node {0} (q0)\n             edge [loop above] node {1} (q1);\n\\end{tikzpicture}",
      question: "Consider the deterministic finite automaton (DFA) shown in the state transition diagram above. Which of the following regular expressions corresponds to the language accepted by this automaton?",
      options: [
        "$(0 + 1)^* 1$",
        "$(0 + 1)^* 1 (0 + 1)^*$",
        "$0^* 1 (0 + 1)^*$",
        "$1 (0 + 1)^*$"
      ],
      answer: 0,
      solution: "Observing the state transitions:\n- The automaton starts in non-accepting state $q_0$.\n- Reading a `0` stays in $q_0$ (or transitions from $q_1$ back to $q_0$).\n- Reading a `1` transitions to the accepting state $q_1$ and stays there on consecutive `1`s.\n- The machine is in accepting state $q_1$ if and only if the last symbol processed was `1`.\nTherefore, the accepted language consists of all strings over $\\{0, 1\\}$ ending with `1`, represented by $(0 + 1)^* 1$."
    },
    {
      id: 6,
      section: "SUBJECT",
      type: "MSQ",
      marks: 2,
      subject: "Algorithms",
      topic: "Asymptotic Analysis & Sorting",
      question: "Which of the following statements regarding comparison-based sorting algorithms are **CORRECT**?",
      options: [
        "Merge Sort has a worst-case time complexity of $\\mathcal{O}(n \\log n)$.",
        "Heap Sort operates in $\\mathcal{O}(1)$ auxiliary space and has $\\mathcal{O}(n \\log n)$ worst-case time.",
        "Quick Sort has an average-case time complexity of $\\mathcal{O}(n \\log n)$.",
        "No comparison-based sorting algorithm can beat $\\Omega(n \\log n)$ in the worst case."
      ],
      answer: [0, 1, 2, 3],
      solution: "All four statements are fundamentally correct:\n1. Merge Sort is always $\\mathcal{O}(n \\log n)$ in best, average, and worst cases.\n2. In-place Heap Sort requires $\\mathcal{O}(1)$ extra memory and guarantees $\\mathcal{O}(n \\log n)$.\n3. Randomized/standard Quick Sort averages $\\mathcal{O}(n \\log n)$.\n4. The decision tree model proves that any comparison sort requires $\\Omega(n \\log n)$ comparisons in the worst case."
    },
    {
      id: 7,
      section: "SUBJECT",
      type: "MSQ",
      marks: 1,
      subject: "Data Structures",
      topic: "Binary Trees & Properties",
      question: "Which of the following are valid depth-first search (DFS) traversals of a binary tree?",
      options: ["Inorder", "Preorder", "Postorder", "Breadth-First Level Order"],
      answer: [0, 1, 2],
      solution: "Inorder, Preorder, and Postorder are the three classical depth-first traversals. Level-order traversal is a breadth-first search (BFS)."
    },
    {
      id: 8,
      section: "SUBJECT",
      type: "NAT",
      marks: 2,
      subject: "Operating Systems",
      topic: "Paging & Memory Systems",
      question: "In a 32-bit virtual memory system with a page size of $4\\text{ KB}$ ($2^{12}\\text{ bytes}$), how many bits are used for the virtual page number (VPN)?",
      answer: 20,
      solution: "Given:\n- Virtual address $= 32\\text{ bits}$\n- Page size $= 4\\text{ KB} = 2^{12}\\text{ bytes} \\implies \\text{Offset} = 12\\text{ bits}$\n- $\\text{Virtual Page Number (VPN)} = 32 - 12 = 20\\text{ bits}$."
    },
    {
      id: 9,
      section: "SUBJECT",
      type: "NAT",
      marks: 1,
      subject: "Data Structures",
      topic: "Complete Binary Trees",
      question: "A strictly complete binary tree has 31 nodes. What is the total number of leaf nodes in this tree?",
      answer: 16,
      solution: "In a complete binary tree with $n$ nodes, the number of leaf nodes is:\n$$L = \\left\\lceil \\frac{n}{2} \\right\\rceil = \\left\\lceil \\frac{31}{2} \\right\\rceil = 16$$"
    },
    {
      id: 10,
      section: "SUBJECT",
      type: "NAT",
      marks: 2,
      subject: "Computer Networks",
      topic: "Flow Control & Sliding Window",
      question: "In a Stop-and-Wait ARQ protocol, the packet size is 1000 bytes and the channel bandwidth is 1 Mbps ($10^6$ bits/sec). The propagation delay $T_p$ is 16 milliseconds. What is the efficiency $\\eta$ in percentage? (Assume negligible ACK transmission time and round to two decimal places).",
      answer: { min: 19.9, max: 20.1 },
      solution: "Transmission time:\n$$T_t = \\frac{1000 \\times 8\\text{ bits}}{10^6\\text{ bps}} = 8\\text{ ms} = 0.008\\text{ s}$$\nPropagation delay: $T_p = 16\\text{ ms} = 0.016\\text{ s}$.\nTotal round-trip cycle time:\n$$T_t + 2T_p = 8 + 32 = 40\\text{ ms}$$\nEfficiency:\n$$\\eta = \\frac{T_t}{T_t + 2T_p} = \\frac{8}{40} = 0.20 = 20.0\\%$$"
    }
  ]
};

export const sampleJSONString = JSON.stringify(sampleTestData, null, 2);
