
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ConceptMapData, Chunk, AnalysisView } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

interface VisualizerProps {
  viewMode: AnalysisView;
  conceptMapData: ConceptMapData | null;
  chunks: Chunk[];
  onTermSelect: (term: string) => void;
}

export const Visualizer: React.FC<VisualizerProps> = ({ 
    viewMode, 
    conceptMapData, 
    chunks,
    onTermSelect
}) => {
  // --- Derived Data ---
  const tagCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    chunks.forEach(c => c.tags.forEach(t => counts.set(t, (counts.get(t) || 0) + 1)));
    return Array.from(counts.entries())
        .map(([text, value]) => ({ text, value }))
        .sort((a, b) => b.value - a.value);
  }, [chunks]);

  const sentimentData = React.useMemo(() => {
    let positive = 0, negative = 0, neutral = 0;
    chunks.forEach(c => {
        if (!c.sentiment) return;
        if (c.sentiment > 0.2) positive++;
        else if (c.sentiment < -0.2) negative++;
        else neutral++;
    });
    return [
        { name: 'Positive', value: positive, color: '#4ade80' },
        { name: 'Neutral', value: neutral, color: '#94a3b8' },
        { name: 'Negative', value: negative, color: '#f87171' }
    ];
  }, [chunks]);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight
      });
    }
  }, [viewMode]);

  // --- D3 Graph Effect ---
  useEffect(() => {
    if (viewMode !== AnalysisView.CONCEPT_MAP || !conceptMapData || !svgRef.current || dimensions.width === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = dimensions.width;
    const height = dimensions.height;

    const nodes = conceptMapData.nodes.map(d => ({ ...d }));
    const links = conceptMapData.links.map(d => ({ ...d }));

    const simulation = d3.forceSimulation(nodes as any)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(50));

    // Markers
    svg.append("defs").append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 28)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#cbd5e1");

    const link = svg.append("g")
      .selectAll("line")
      .data(links)
      .enter().append("line")
      .attr("stroke", "#e2e8f0")
      .attr("stroke-width", d => Math.sqrt((d as any).strength || 1) * 2)
      .attr("marker-end", "url(#arrow)");

    const linkLabel = svg.append("g")
      .selectAll("text")
      .data(links)
      .enter().append("text")
      .text(d => (d as any).label)
      .attr("font-size", "10px")
      .attr("fill", "#94a3b8")
      .attr("text-anchor", "middle")
      .attr("dy", -5);

    const node = svg.append("g")
      .selectAll("g")
      .data(nodes)
      .enter().append("g")
      .call(d3.drag<any, any>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      )
      .on("click", (event, d) => onTermSelect(d.label));

    node.append("circle")
      .attr("r", d => 15 + ((d as any).value || 1) * 1.5)
      .attr("fill", "#eff6ff")
      .attr("stroke", "#6366f1")
      .attr("stroke-width", 2);

    node.append("text")
      .text(d => (d as any).label)
      .attr("text-anchor", "middle")
      .attr("dy", 4)
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("fill", "#1e293b")
      .style("pointer-events", "none");

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      linkLabel
        .attr("x", (d: any) => (d.source.x + d.target.x) / 2)
        .attr("y", (d: any) => (d.source.y + d.target.y) / 2);

      node
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

  }, [viewMode, conceptMapData, dimensions]);


  // --- Render Views ---

  if (viewMode === AnalysisView.DASHBOARD) {
     return (
        <div className="h-full overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50">
            {/* Tag Frequency */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm col-span-2 md:col-span-1">
                <h3 className="text-lg font-semibold text-slate-800 mb-6">Theme Dominance</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={tagCounts.slice(0, 10)} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                            <XAxis type="number" hide />
                            <YAxis dataKey="text" type="category" width={100} tick={{fontSize: 12}} />
                            <Tooltip cursor={{fill: '#f1f5f9'}} />
                            <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]}>
                                {tagCounts.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={`hsl(240, 80%, ${70 - (index * 4)}%)`} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Sentiment */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm col-span-2 md:col-span-1">
                <h3 className="text-lg font-semibold text-slate-800 mb-6">Sentiment Analysis</h3>
                <div className="h-64 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={sentimentData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {sentimentData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Key Insights Stats */}
            <div className="col-span-2 grid grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                    <div className="text-3xl font-bold text-indigo-600">{chunks.length}</div>
                    <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Segments</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                    <div className="text-3xl font-bold text-amber-500">{tagCounts.length}</div>
                    <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Unique Concepts</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                     <div className="text-3xl font-bold text-emerald-500">
                        {Math.round((sentimentData.find(d => d.name === 'Positive')?.value || 0) / chunks.length * 100)}%
                     </div>
                     <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Positivity Rate</div>
                </div>
            </div>
        </div>
     );
  }

  // Fallback / Graph View
  return (
    <div className="w-full h-full flex items-center justify-center bg-slate-50 relative" ref={containerRef}>
       {!conceptMapData || conceptMapData.nodes.length === 0 ? (
           <div className="text-center text-slate-400">
               <span className="material-symbols-outlined text-6xl mb-2 text-slate-300">hub</span>
               <p>No concept map data generated.</p>
           </div>
       ) : (
           <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="w-full h-full" />
       )}
    </div>
  );
};