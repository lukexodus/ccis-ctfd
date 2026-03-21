import { mergeObjects } from "../../objects";
import { cumulativeSum } from "../../math";
import dayjs from "dayjs";

const CHART_TEXT_COLOR = "#d4f5e2";
const CHART_GRID_COLOR = "rgba(0, 229, 102, 0.15)";
const CHART_CANVAS_BG = "rgba(0, 8, 2, 0.72)";
const CHART_LINE_COLORS = ["#00bf54", "#4dff9a"];
const TOOLTIP_BG = "rgba(0, 20, 8, 0.95)";
const TOOLTIP_TITLE = "#4dff9a";
const TOOLTIP_BODY = "#d4f5e2";

export function getOption(mode, places, optionMerge) {
  let option = {
    backgroundColor: CHART_CANVAS_BG,
    textStyle: {
      color: CHART_TEXT_COLOR,
    },
    title: {
      left: "center",
      text: "Top 10 " + (mode === "teams" ? "Teams" : "Users"),
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
      bottom: 35,
      data: [],
      textStyle: {
        color: CHART_TEXT_COLOR,
      },
    },
    toolbox: {
      iconStyle: {
        borderColor: CHART_TEXT_COLOR,
      },
      feature: {
        dataZoom: {
          yAxisIndex: "none",
        },
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
        type: "time",
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
            color: "#00bf54",
          },
          areaStyle: {
            color: "rgba(0, 191, 84, 0.12)",
          },
        },
        handleStyle: {
          color: "rgba(0, 191, 84, 0.2)",
          borderColor: "#00bf54",
        },
      },
    ],
    series: [],
  };

  const teams = Object.keys(places);
  for (let i = 0; i < teams.length; i++) {
    const team_score = [];
    const times = [];
    for (let j = 0; j < places[teams[i]]["solves"].length; j++) {
      team_score.push(places[teams[i]]["solves"][j].value);
      const date = dayjs(places[teams[i]]["solves"][j].date);
      times.push(date.toDate());
    }

    const total_scores = cumulativeSum(team_score);
    let scores = times.map(function (e, i) {
      return [e, total_scores[i]];
    });

    option.legend.data.push(places[teams[i]]["name"]);

    const data = {
      name: places[teams[i]]["name"],
      type: "line",
      lineStyle: {
        color: CHART_LINE_COLORS[i % CHART_LINE_COLORS.length],
        width: 2,
      },
      label: {
        normal: {
          position: "top",
          color: CHART_TEXT_COLOR,
        },
      },
      itemStyle: {
        normal: {
          color: CHART_LINE_COLORS[i % CHART_LINE_COLORS.length],
        },
      },
      areaStyle: {
        color: "transparent",
      },
      data: scores,
    };
    option.series.push(data);
  }

  if (optionMerge) {
    option = mergeObjects(option, optionMerge);
  }
  return option;
}
