import { ImageAnalysisResponse } from '@/core/interfaces/image-analysis.type';
import { Component, signal } from '@angular/core';
import { AnalyzerPanelComponent } from './components/analyzer-panel/analyzer-panel.component';
import { ThoughtSummaryComponent } from './components/thought-summary/thought-summary.component';

@Component({
  selector: 'app-dashboard',
  imports: [ThoughtSummaryComponent, AnalyzerPanelComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export default class DashboardComponent {
  analysis = signal<ImageAnalysisResponse | undefined>(undefined);
}
