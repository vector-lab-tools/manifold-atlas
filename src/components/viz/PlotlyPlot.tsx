"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

let plotlyPromise: Promise<any> | null = null;
function getPlotly(): Promise<any> {
  if (!plotlyPromise) {
    plotlyPromise = import("plotly.js-gl3d-dist-min");
  }
  return plotlyPromise;
}

interface PlotlyPlotProps {
  data: any[];
  layout?: Record<string, any>;
  config?: Record<string, any>;
  style?: React.CSSProperties;
}

export interface PlotlyPlotHandle {
  getDiv: () => HTMLDivElement | null;
  getPlotly: () => any;
}

export const PlotlyPlot = forwardRef<PlotlyPlotHandle, PlotlyPlotProps>(
  function PlotlyPlot({ data, layout, config, style }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const plotlyRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      getDiv: () => containerRef.current,
      getPlotly: () => plotlyRef.current,
    }));

    useEffect(() => {
      let mounted = true;

      getPlotly().then(Plotly => {
        if (!mounted || !containerRef.current) return;
        plotlyRef.current = Plotly;
        Plotly.newPlot(containerRef.current, data, layout, config);
      });

      return () => {
        mounted = false;
        if (containerRef.current && plotlyRef.current) {
          plotlyRef.current.purge(containerRef.current);
        }
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Track whether this is the initial render
    const initialRender = useRef(true);

    useEffect(() => {
      if (!containerRef.current || !plotlyRef.current) return;
      if (initialRender.current) {
        initialRender.current = false;
        return; // skip — newPlot already ran
      }
      // On data updates, only update data traces without resetting the camera
      // by omitting the layout (which contains the initial camera position)
      plotlyRef.current.react(containerRef.current, data);
    }, [data]);

    // Layout-only updates (rare, e.g. theme change)
    useEffect(() => {
      if (!containerRef.current || !plotlyRef.current || initialRender.current) return;
      plotlyRef.current.relayout(containerRef.current, layout);
    }, [layout]);

    return <div ref={containerRef} style={style} />;
  }
);
