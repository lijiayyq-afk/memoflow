<!-- Heatmap.svelte - MemoFlow 笔记活动热力图组件 -->
<script lang="ts">
  import { memos } from '$lib/stores/memos';
  
  // 获取最近 6 个月的日期格数据
  // 我们定义每周 7 天，从周日到周六
  interface DayData {
    date: Date;
    dateString: string; // YYYY-MM-DD
    count: number;
    level: number; // 0, 1, 2, 3, 4 代表不同绿色深度
  }

  // Tooltip 状态
  let tooltipText = $state('');
  let tooltipVisible = $state(false);
  let tooltipX = $state(0);
  let tooltipY = $state(0);

  // 响应式派生：计算最近 6 个月的日期数据矩阵（列优先，每列 7 天）
  let columns = $derived.by(() => {
    const today = new Date();
    // 6 个月前的时间，大约 180 天
    const startDate = new Date();
    startDate.setDate(today.getDate() - 180);
    
    // 调整到那周的周日开始，以保证热力图对齐
    const startDay = startDate.getDay();
    startDate.setDate(startDate.getDate() - startDay);

    // 将 Memos 的创建时间整理成 YYYY-MM-DD -> 计数 的映射
    const memoCounts: Record<string, number> = {};
    $memos.items.forEach(memo => {
      // 排除已归档的笔记（或根据设计只算活跃笔记）
      if (memo.isArchived) return;
      
      const date = new Date(memo.createdAt);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      memoCounts[dateStr] = (memoCounts[dateStr] || 0) + 1;
    });

    const cols: DayData[][] = [];
    const tempDate = new Date(startDate.getTime());

    // 生成 26 周（大约 6 个月）的列数据
    for (let w = 0; w < 27; w++) {
      const col: DayData[] = [];
      for (let d = 0; d < 7; d++) {
        // 如果超出了今天，就不再继续生成以后的格子（或者生成但设为不可用，这里我们限制到今天）
        const year = tempDate.getFullYear();
        const month = String(tempDate.getMonth() + 1).padStart(2, '0');
        const day = String(tempDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        const count = memoCounts[dateStr] || 0;
        let level = 0;
        if (count > 0) {
          if (count === 1) level = 1;
          else if (count <= 3) level = 2;
          else if (count <= 5) level = 3;
          else level = 4;
        }

        col.push({
          date: new Date(tempDate.getTime()),
          dateString: dateStr,
          count,
          level
        });

        // 递增一天
        tempDate.setDate(tempDate.getDate() + 1);
      }
      cols.push(col);
    }
    return cols;
  });

  // 处理鼠标移入格子
  function handleMouseEnter(day: DayData, event: MouseEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    // 计算 Tooltip 显示的位置（在格子上方居中）
    tooltipX = rect.left + window.scrollX + rect.width / 2;
    tooltipY = rect.top + window.scrollY - 32;
    tooltipText = `${day.dateString} : ${day.count} 条记录`;
    tooltipVisible = true;
  }

  // 处理鼠标移出格子
  function handleMouseLeave() {
    tooltipVisible = false;
  }

  // 计算月份标签显示位置
  const months = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  let monthLabels = $derived.by(() => {
    const labels: { text: string; colIndex: number }[] = [];
    let lastMonth = -1;
    columns.forEach((col, index) => {
      const firstDayOfMonth = col[0].date;
      const currentMonth = firstDayOfMonth.getMonth();
      // 如果这一列的第1天是一个新月份，并且离上一个标出来的月份有一段距离，就标出来
      if (currentMonth !== lastMonth && index % 4 === 0) {
        labels.push({
          text: months[currentMonth],
          colIndex: index
        });
        lastMonth = currentMonth;
      }
    });
    return labels;
  });
</script>

<div class="heatmap-container card">
  <div class="heatmap-header">
    <span class="title">记录热力图</span>
    <span class="subtitle">最近 6 个月的活动状态</span>
  </div>

  <div class="heatmap-wrapper">
    <!-- 星期标签列 -->
    <div class="week-labels">
      <span>日</span>
      <span>二</span>
      <span>四</span>
      <span>六</span>
    </div>

    <!-- 热力图网格 -->
    <div class="heatmap-grid-scroll">
      <div class="heatmap-grid-container">
        <!-- 月份标题行 -->
        <div class="month-row">
          {#each monthLabels as label}
            <span class="month-label" style="grid-column-start: {label.colIndex + 1}">
              {label.text}
            </span>
          {/each}
        </div>

        <!-- 格子列排布 -->
        <div class="grid-columns">
          {#each columns as col, colIdx}
            <div class="grid-column">
              {#each col as day}
                <!-- 只渲染到今天及以前的日期，未来的日期显示空白 -->
                {#if day.date <= new Date()}
                  <button
                    class="grid-cell level-{day.level}"
                    aria-label="{day.dateString} : {day.count} memo"
                    onmouseenter={(e) => handleMouseEnter(day, e)}
                    onmouseleave={handleMouseLeave}
                  ></button>
                {:else}
                  <div class="grid-cell empty"></div>
                {/if}
              {/each}
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>

  <!-- 图例 -->
  <div class="heatmap-legend">
    <span>少</span>
    <div class="legend-cell level-0"></div>
    <div class="legend-cell level-1"></div>
    <div class="legend-cell level-2"></div>
    <div class="legend-cell level-3"></div>
    <div class="legend-cell level-4"></div>
    <span>多</span>
  </div>
</div>

<!-- 悬浮提示框 Tooltip -->
{#if tooltipVisible}
  <div class="heatmap-tooltip" style="left: {tooltipX}px; top: {tooltipY}px;">
    {tooltipText}
    <div class="tooltip-arrow"></div>
  </div>
{/if}

<style>
  .heatmap-container {
    padding: var(--spacing-base);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    width: 100%;
    overflow: hidden;
  }

  .heatmap-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .heatmap-header .title {
    font-size: var(--fs-sm);
    font-weight: var(--fw-semibold);
    color: var(--color-text);
  }

  .heatmap-header .subtitle {
    font-size: var(--fs-xs);
    color: var(--color-text-secondary);
  }

  .heatmap-wrapper {
    display: flex;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-xs);
    position: relative;
  }

  .week-labels {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    font-size: var(--fs-xs);
    color: var(--color-text-secondary);
    padding-top: 18px; /* 留出月份行的高度 */
    padding-bottom: 2px;
    height: 106px; /* 对齐格子高度 12*7 + 2*6 = 96px 加上间距 */
    user-select: none;
  }

  .heatmap-grid-scroll {
    flex: 1;
    overflow-x: auto;
    scrollbar-width: none; /* Firefox */
  }

  .heatmap-grid-scroll::-webkit-scrollbar {
    display: none; /* Safari & Chrome */
  }

  .heatmap-grid-container {
    display: flex;
    flex-direction: column;
    min-width: max-content;
  }

  .month-row {
    display: grid;
    grid-template-columns: repeat(27, 14px); /* 12px cell + 2px gap */
    height: 18px;
    font-size: var(--fs-xs);
    color: var(--color-text-secondary);
    user-select: none;
  }

  .month-label {
    grid-row: 1;
    white-space: nowrap;
  }

  .grid-columns {
    display: flex;
    gap: 2px;
  }

  .grid-column {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .grid-cell {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: transform var(--transition-fast);
  }

  .grid-cell:hover {
    transform: scale(1.2);
    z-index: 10;
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.15);
  }

  .grid-cell.empty {
    background-color: transparent;
    cursor: default;
  }

  /* 绿色系深浅色阶 */
  .level-0 {
    background-color: #EBEDF0;
  }
  .level-1 {
    background-color: #C6E48B;
  }
  .level-2 {
    background-color: #7BC96F;
  }
  .level-3 {
    background-color: #239A3B;
  }
  .level-4 {
    background-color: #196127;
  }

  .heatmap-legend {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 3px;
    font-size: var(--fs-xs);
    color: var(--color-text-secondary);
    user-select: none;
  }

  .legend-cell {
    width: 10px;
    height: 10px;
    border-radius: 1px;
  }

  /* Tooltip 样式 */
  .heatmap-tooltip {
    position: absolute;
    background-color: #1a1a1a;
    color: #ffffff;
    padding: 6px var(--spacing-sm);
    border-radius: var(--radius-sm);
    font-size: var(--fs-xs);
    pointer-events: none;
    transform: translateX(-50%);
    white-space: nowrap;
    box-shadow: var(--shadow-md);
    z-index: 9999;
    animation: fadeIn var(--transition-fast) forwards;
  }

  .tooltip-arrow {
    position: absolute;
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 4px solid #1a1a1a;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translate(-50%, 4px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }
</style>
