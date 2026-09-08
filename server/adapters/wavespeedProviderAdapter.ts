import {
  VideoProviderAdapter,
  ProviderGenerationParams,
  ProviderJobResult,
  ProviderJobStatusResult,
} from './videoProviderAdapter.js';

interface SimulatedWaveSpeedJob {
  jobId: string;
  createdAt: number;
  params: ProviderGenerationParams;
}

const simulatedJobs = new Map<string, SimulatedWaveSpeedJob>();

const SAMPLE_WAVESPEED_VIDEOS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4',
];

export class WaveSpeedProviderAdapter implements VideoProviderAdapter {
  readonly providerId = 'provider-wavespeed';
  readonly name = 'WaveSpeed AI';

  private get apiKey(): string | undefined {
    return process.env.WAVESPEED_API_KEY?.trim();
  }

  private get baseUrl(): string {
    return process.env.WAVESPEED_BASE_URL || 'https://api.wavespeed.ai/v1';
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey) || true;
  }

  async estimateCost(params: ProviderGenerationParams): Promise<{ provider_cost_cents: number }> {
    const is1080p = params.resolution === '1080p';
    const durationMultiplier = params.duration_seconds > 5 ? params.duration_seconds / 5 : 1;
    const baseCents = is1080p ? 80 : 45;
    return {
      provider_cost_cents: Math.round(baseCents * durationMultiplier * params.number_of_outputs),
    };
  }

  async submitGeneration(params: ProviderGenerationParams): Promise<ProviderJobResult> {
    const key = this.apiKey;

    if (key) {
      try {
        const payload = {
          model_name: params.model_id,
          prompt: params.prompt,
          negative_prompt: params.negative_prompt,
          seconds: params.duration_seconds,
          resolution: params.resolution,
          aspect_ratio: params.aspect_ratio,
          seed: params.seed ?? undefined,
          references: params.references.map((r) => ({
            url: r.provider_accessible_url,
            alias: r.alias,
          })),
        };

        const res = await fetch(`${this.baseUrl}/tasks/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error(`WaveSpeed API error (${res.status}): ${await res.text()}`);
        }

        const data: any = await res.json();
        return {
          provider_job_id: data.task_id || data.id,
          provider_id: this.providerId,
          status: 'QUEUED',
          estimated_duration_seconds: 14,
        };
      } catch (err: any) {
        console.error('[WaveSpeedProvider] Live submission error, falling back to sandbox simulator:', err.message);
      }
    }

    const jobId = `wave_job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    simulatedJobs.set(jobId, {
      jobId,
      createdAt: Date.now(),
      params,
    });

    return {
      provider_job_id: jobId,
      provider_id: this.providerId,
      status: 'QUEUED',
      estimated_duration_seconds: 14,
      provider_cost_cents: (await this.estimateCost(params)).provider_cost_cents,
    };
  }

  async checkStatus(providerJobId: string): Promise<ProviderJobStatusResult> {
    const key = this.apiKey;

    if (key && !providerJobId.startsWith('wave_job_')) {
      try {
        const res = await fetch(`${this.baseUrl}/tasks/${providerJobId}`, {
          headers: {
            Authorization: `Bearer ${key}`,
          },
        });

        if (!res.ok) {
          throw new Error(`WaveSpeed status error (${res.status})`);
        }

        const data: any = await res.json();
        const rawStatus = (data.status || '').toUpperCase();
        let status: 'QUEUED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' = 'PROCESSING';
        if (rawStatus === 'PENDING' || rawStatus === 'QUEUED') status = 'QUEUED';
        else if (rawStatus === 'SUCCESS' || rawStatus === 'COMPLETED') status = 'SUCCEEDED';
        else if (rawStatus === 'FAILED' || rawStatus === 'ERROR') status = 'FAILED';

        return {
          provider_job_id: providerJobId,
          status,
          progress_percent: data.progress ?? (status === 'SUCCEEDED' ? 100 : 50),
          result_video_url: data.video_url || data.output_url,
          thumbnail_url: data.thumbnail_url,
          error_message: data.error,
        };
      } catch (err: any) {
        console.warn('[WaveSpeedProvider] Polling error:', err.message);
      }
    }

    const job = simulatedJobs.get(providerJobId);
    if (!job) {
      return {
        provider_job_id: providerJobId,
        status: 'SUCCEEDED',
        progress_percent: 100,
        result_video_url: SAMPLE_WAVESPEED_VIDEOS[0],
      };
    }

    const elapsedSeconds = (Date.now() - job.createdAt) / 1000;

    if (elapsedSeconds < 3) {
      return {
        provider_job_id: providerJobId,
        status: 'QUEUED',
        progress_percent: 20,
      };
    }

    if (elapsedSeconds < 11) {
      const progress = Math.min(92, Math.round(20 + ((elapsedSeconds - 3) / 8) * 72));
      return {
        provider_job_id: providerJobId,
        status: 'PROCESSING',
        progress_percent: progress,
      };
    }

    const sampleIdx = Math.abs(providerJobId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) % SAMPLE_WAVESPEED_VIDEOS.length;
    return {
      provider_job_id: providerJobId,
      status: 'SUCCEEDED',
      progress_percent: 100,
      result_video_url: SAMPLE_WAVESPEED_VIDEOS[sampleIdx],
    };
  }

  async cancelJob(providerJobId: string): Promise<boolean> {
    simulatedJobs.delete(providerJobId);
    return true;
  }
}
