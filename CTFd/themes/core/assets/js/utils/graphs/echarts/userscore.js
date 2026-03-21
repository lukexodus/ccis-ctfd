import { cumulativeSum } from "../../math";
import { mergeObjects } from "../../objects";
import dayjs from "dayjs";

const CHART_TEXT_COLOR = "#d4f5e2";
const CHART_GRID_COLOR = "rgba(0, 229, 102, 0.15)";
const CHART_CANVAS_BG = "rgba(0, 8, 2, 0.72)";
const CHART_LINE_COLOR = "#00bf54";
const TOOLTIP_BG = "rgba(0, 20, 8, 0.95)";
const TOOLTIP_TITLE = "#4dff9a";
const TOOLTIP_BODY = "#d4f5e2";

export function getOption(id, name, solves, awards, optionMerge) {
  let option = {
    backgroundColor: CHART_CANVAS_BG,
    textStyle: {
      color: CHART_TEXT_COLOR,
    },
    title: {
      left: "center",
      text: "Score over Time",
      textStyle: {
        color: CHART_TEXT_COLOR,
      },
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: TOOLTIP_BG,
      borderColor: CHART_GRID_COLOR,
      borderWidth: 1,
      textStyle: {
        color: TOOLTIP_BODY,
      },
      extraCssText: "box-shadow: 0 0 14px rgba(0, 191, 84, 0.22);",
      axisPointer: {
        type: "cross",
        lineStyle: {
          color: CHART_GRID_COLOR,
        },
      },
      titleTextStyle: {
        color: TOOLTIP_TITLE,
      },
    },
    legend: {
      type: "scroll",
      orient: "horizontal",
      align: "left",
      bottom: 0,
      data: [name],
      textStyle: {
        color: CHART_TEXT_COLOR,
      },
    },
    toolbox: {
      iconStyle: {
        borderColor: CHART_TEXT_COLOR,
      },
      feature: {
        saveAsImage: {},
      },
    },
    grid: {
      containLabel: true,
      show: true,
      backgroundColor: CHART_CANVAS_BG,
      borderColor: "transparent",
    },
    xAxis: [
      {
        type: "category",
        boundaryGap: false,
        data: [],
        axisLabel: {
          color: CHART_TEXT_COLOR,
        },
        axisLine: {
          lineStyle: {
            color: CHART_GRID_COLOR,
          },
        },
        splitLine: {
          lineStyle: {
            color: CHART_GRID_COLOR,
          },
        },
      },
    ],
    yAxis: [
      {
        type: "value",
        axisLabel: {
          color: CHART_TEXT_COLOR,
        },
        axisLine: {
          lineStyle: {
            color: CHART_GRID_COLOR,
          },
        },
        splitLine: {
          lineStyle: {
            color: CHART_GRID_COLOR,
          },
        },
      },
    ],
    dataZoom: [
      {
        id: "dataZoomX",
        type: "slider",
        xAxisIndex: [0],
        filterMode: "filter",
        height: 20,
        top: 35,
        fillerColor: "rgba(0, 191, 84, 0.08)",
        backgroundColor: "transparent",
        borderColor: CHART_GRID_COLOR,
        dataBackground: {
          lineStyle: {
            color: CHART_GRID_COLOR,
          },
          areaStyle: {
            color: "rgba(0, 191, 84, 0.03)",
          },
        },
        selectedDataBackground: {
          lineStyle: {
            color: CHART_LINE_COLOR,
          },
          areaStyle: {
            color: "rgba(0, 191, 84, 0.12)",
          },
        },
        handleStyle: {
          color: "rgba(0, 191, 84, 0.2)",
          borderColor: CHART_LINE_COLOR,
        },
      },
    ],
    series: [],
  };

  const times = [];
  const scores = [];
  const total = solves.concat(awards);

  total.sort((a, b) => {
    return new Date(a.date) - new Date(b.date);
  });

  for (let i = 0; i < total.length; i++) {
    const date = dayjs(total[i].date);
    times.push(date.toDate());
    try {
      scores.push(total[i].challenge.value);
    } catch (e) {
      scores.push(total[i].value);
    }
  }

  times.forEach(time => {
    option.xAxis[0].data.push(time);
  });

  option.series.push({
    name: name,
    type: "line",
    lineStyle: {
      color: CHART_LINE_COLOR,
      width: 2,
    },
    label: {
      normal: {
        show: true,
        position: "top",
        color: CHART_TEXT_COLOR,
      },
    },
    areaStyle: {
      normal: {
        color: "transparent",
      },
    },
    itemStyle: {
      normal: {
        color: CHART_LINE_COLOR,
      },
    },
    data: cumulativeSum(scores),
  });

  if (optionMerge) {
    option = mergeObjects(option, optionMerge);
  }
  return option;
}
