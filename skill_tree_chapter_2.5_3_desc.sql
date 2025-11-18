-- 第2.5章（间章：含苞）和第三章知识点描述更新SQL
-- 按照之前的描述风格添加 tag_desc 字段

-- 间章（2.5）知识点描述 - tagid从1200开始
UPDATE tracker_tag SET tag_desc='掌握如何在代码中处理几何问题，包括点、线、面的计算和判断，这是解决空间相关算法题的基础。' WHERE tag_id=1200;
UPDATE tracker_tag SET tag_desc='探索如何在代码中实现博弈论算法，解决游戏和决策问题，掌握必胜态和必败态的分析方法。' WHERE tag_id=1201;
UPDATE tracker_tag SET tag_desc='学习如何编写更复杂的模拟程序，处理多步骤和多状态的问题，提高代码实现的准确性。' WHERE tag_id=1202;
UPDATE tracker_tag SET tag_desc='了解如何构造更复杂的算法和数据结构，通过巧妙的构造方法解决特定问题。' WHERE tag_id=1203;
UPDATE tracker_tag SET tag_desc='掌握如何使用贪心策略和优先队列优化算法，在满足局部最优的情况下寻找全局最优解。' WHERE tag_id=1204;

-- 第三章知识点描述 - tagid从1300开始

-- 搜索入门
UPDATE tracker_tag SET tag_desc='掌握深度优先搜索算法，用于遍历图和树结构，理解递归回溯的实现技巧。' WHERE tag_id=1300;
UPDATE tracker_tag SET tag_desc='学习广度优先搜索算法，用于最短路径和层次遍历，掌握队列在搜索中的应用。' WHERE tag_id=1301;
UPDATE tracker_tag SET tag_desc='了解双指针技巧，优化数组和字符串处理，提高算法的时间复杂度。' WHERE tag_id=1302;
UPDATE tracker_tag SET tag_desc='掌握二分搜索算法，在有序数据中快速查找目标值，理解边界条件的处理。' WHERE tag_id=1303;

-- 图论入门
UPDATE tracker_tag SET tag_desc='了解树和图的基本概念和表示方法，理解节点、边、路径等基本术语。' WHERE tag_id=1304;
UPDATE tracker_tag SET tag_desc='掌握如何构建图结构并进行搜索，理解邻接表和邻接矩阵的表示方法。' WHERE tag_id=1305;
UPDATE tracker_tag SET tag_desc='学习在无权图中寻找最短路径，掌握BFS在最短路径问题中的应用。' WHERE tag_id=1306;

-- 动态规划进阶
UPDATE tracker_tag SET tag_desc='掌握动态规划中的背包问题基础，理解01背包、完全背包等经典模型。' WHERE tag_id=1307;
UPDATE tracker_tag SET tag_desc='学习区间动态规划，解决区间相关问题，掌握状态转移方程的推导方法。' WHERE tag_id=1308;
UPDATE tracker_tag SET tag_desc='探索树形动态规划，在树结构上应用动态规划，理解自底向上和自顶向下的遍历方式。' WHERE tag_id=1309;
UPDATE tracker_tag SET tag_desc='了解状态压缩动态规划，通过位运算优化状态空间，解决状态数较多的问题。' WHERE tag_id=1310;
UPDATE tracker_tag SET tag_desc='综合练习各种动态规划问题，巩固和提升动态规划算法的应用能力。' WHERE tag_id=1311;

-- 枚举进阶
UPDATE tracker_tag SET tag_desc='掌握使用状态压缩进行枚举，通过位运算高效地枚举所有可能的状态组合。' WHERE tag_id=1312;
UPDATE tracker_tag SET tag_desc='学习枚举集合的所有子集，理解二进制枚举和递归枚举的实现方法。' WHERE tag_id=1313;
UPDATE tracker_tag SET tag_desc='综合练习各种枚举技巧，提高在复杂问题中快速枚举所有可能情况的能力。' WHERE tag_id=1314;

-- 并查集
UPDATE tracker_tag SET tag_desc='掌握并查集数据结构，用于快速合并和查找集合，理解路径压缩和按秩合并的优化技巧。' WHERE tag_id=1315;
UPDATE tracker_tag SET tag_desc='学习最小生成树算法，连接图中所有节点并使得总权重最小，掌握Kruskal和Prim算法。' WHERE tag_id=1316;

