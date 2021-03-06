// Libraries

import React from 'react';
import { css } from 'emotion';
import { GraphSeriesValue } from '@grafana/data';

import { Graph, GraphProps } from './Graph';
import { LegendRenderOptions, LegendItem, LegendDisplayMode } from '../Legend/Legend';
import { GraphLegend } from './GraphLegend';
import { CustomScrollbar } from '../CustomScrollbar/CustomScrollbar';
import { stylesFactory } from '../../themes';

export type SeriesOptionChangeHandler<TOption> = (label: string, option: TOption) => void;
export type SeriesColorChangeHandler = SeriesOptionChangeHandler<string>;
export type SeriesAxisToggleHandler = SeriesOptionChangeHandler<number>;

export interface GraphWithLegendProps extends GraphProps, LegendRenderOptions {
  legendDisplayMode: LegendDisplayMode;
  sortLegendBy?: string;
  sortLegendDesc?: boolean;
  onSeriesColorChange?: SeriesColorChangeHandler;
  onSeriesAxisToggle?: SeriesAxisToggleHandler;
  onSeriesToggle?: (label: string, event: React.MouseEvent<HTMLElement>) => void;
  onToggleSort: (sortBy: string) => void;
}

const getGraphWithLegendStyles = stylesFactory(({ placement }: GraphWithLegendProps) => ({
  wrapper: css`
    display: flex;
    flex-direction: ${placement === 'bottom' ? 'column' : 'row'};
    height: 100%;
  `,
  graphContainer: css`
    min-height: 65%;
    flex-grow: 1;
  `,
  legendContainer: css`
    padding: 10px 0;
    max-height: ${placement === 'bottom' ? '35%' : 'none'};
  `,
}));

const shouldHideLegendItem = (data: GraphSeriesValue[][], hideEmpty = false, hideZero = false) => {
  const isZeroOnlySeries = data.reduce((acc, current) => acc + (current[1] || 0), 0) === 0;
  const isNullOnlySeries = !data.reduce((acc, current) => acc && current[1] !== null, true);

  return (hideEmpty && isNullOnlySeries) || (hideZero && isZeroOnlySeries);
};

export const GraphWithLegend: React.FunctionComponent<GraphWithLegendProps> = (props: GraphWithLegendProps) => {
  const {
    series,
    timeRange,
    width,
    height,
    showBars,
    showLines,
    showPoints,
    sortLegendBy,
    sortLegendDesc,
    legendDisplayMode,
    placement,
    onSeriesAxisToggle,
    onSeriesColorChange,
    onSeriesToggle,
    onToggleSort,
    hideEmpty,
    hideZero,
    isStacked,
    lineWidth,
    onHorizontalRegionSelected,
    timeZone,
    children,
    ariaLabel,
  } = props;
  const { graphContainer, wrapper, legendContainer } = getGraphWithLegendStyles(props);

  const legendItems = series.reduce<LegendItem[]>((acc, s) => {
    return shouldHideLegendItem(s.data, hideEmpty, hideZero)
      ? acc
      : acc.concat([
          {
            label: s.label,
            color: s.color || '',
            disabled: !s.isVisible,
            yAxis: s.yAxis.index,
            displayValues: s.info || [],
          },
        ]);
  }, []);

  return (
    <div className={wrapper} aria-label={ariaLabel}>
      <div className={graphContainer}>
        <Graph
          series={series}
          timeRange={timeRange}
          timeZone={timeZone}
          showLines={showLines}
          showPoints={showPoints}
          showBars={showBars}
          width={width}
          height={height}
          isStacked={isStacked}
          lineWidth={lineWidth}
          onHorizontalRegionSelected={onHorizontalRegionSelected}
        >
          {children}
        </Graph>
      </div>

      {legendDisplayMode !== LegendDisplayMode.Hidden && (
        <div className={legendContainer}>
          <CustomScrollbar hideHorizontalTrack>
            <GraphLegend
              items={legendItems}
              displayMode={legendDisplayMode}
              placement={placement}
              sortBy={sortLegendBy}
              sortDesc={sortLegendDesc}
              onLabelClick={(item, event) => {
                if (onSeriesToggle) {
                  onSeriesToggle(item.label, event);
                }
              }}
              onSeriesColorChange={onSeriesColorChange}
              onSeriesAxisToggle={onSeriesAxisToggle}
              onToggleSort={onToggleSort}
            />
          </CustomScrollbar>
        </div>
      )}
    </div>
  );
};
