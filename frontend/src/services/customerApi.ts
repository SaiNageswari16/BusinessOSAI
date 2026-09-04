import { apiClient } from './apiClient';
import type {
  CustomerProfile,
  CustomerDashboardData,
  CustomerAttendanceData,
  CustomerBiometricStatus,
  CustomerBodyScanMetrics,
  CustomerWorkoutSplit,
  CustomerTodayWorkout,
  CustomerNutritionData,
  FoodScanResult,
  AICoachRecommendation,
  AITargetRecommendation,
  TransformationResponse,
  SavedTransformationRecord,
} from '@/types/customer';

export interface AnalyzeTargetsPayload {
  weight_kg: number;
  height_cm: number;
  age: number;
  gender: string;
  goal: string;
  workout_type: string;
  target_weight_kg?: number;
  days_per_week?: number;
}

export const customerApi = {
  getProfile: (): Promise<CustomerProfile> =>
    apiClient.get<CustomerProfile>('/customer/me'),

  updateProfile: (data: Partial<CustomerProfile>): Promise<{ status: string; message: string }> =>
    apiClient.patch<{ status: string; message: string }>('/customer/me', data),

  getDashboard: (): Promise<CustomerDashboardData> =>
    apiClient.get<CustomerDashboardData>('/customer/dashboard'),

  getAttendance: (): Promise<CustomerAttendanceData> =>
    apiClient.get<CustomerAttendanceData>('/customer/attendance'),

  getBiometricStatus: (): Promise<CustomerBiometricStatus> =>
    apiClient.get<CustomerBiometricStatus>('/customer/biometric-status'),

  getLatestBodyScan: (): Promise<CustomerBodyScanMetrics> =>
    apiClient.get<CustomerBodyScanMetrics>('/customer/body-composition/latest'),

  getWorkoutSplit: (): Promise<CustomerWorkoutSplit> =>
    apiClient.get<CustomerWorkoutSplit>('/customer/workouts/split'),

  getTodaysWorkout: (): Promise<CustomerTodayWorkout> =>
    apiClient.get<CustomerTodayWorkout>('/customer/workouts/today'),

  getExercisesByMuscle: (muscle?: string): Promise<{ muscle?: string; count: number; exercises: any[] }> =>
    apiClient.get(`/customer/workouts/exercises-by-muscle${muscle ? `?muscle=${muscle}` : ''}`),

  getExercisesForMuscle: (muscleId: string, equipment?: string, difficulty?: string): Promise<{ muscle_id: string; count: number; exercises: any[] }> => {
    let url = `/customer/workouts/muscles/${muscleId}/exercises`;
    const params = new URLSearchParams();
    if (equipment) params.append('equipment', equipment);
    if (difficulty) params.append('difficulty', difficulty);
    if (params.toString()) url += `?${params.toString()}`;
    return apiClient.get(url);
  },

  searchExercises: (q: string): Promise<{ query: string; count: number; results: any[] }> =>
    apiClient.get(`/customer/workouts/exercises/search?q=${encodeURIComponent(q)}`),

  getExerciseDetails: (exerciseId: string): Promise<{ exercise_id: string; details: any; personal_best: any; history: any[] }> =>
    apiClient.get(`/customer/workouts/exercises/${exerciseId}`),

  getMuscles: (): Promise<any[]> =>
    apiClient.get('/customer/workouts/muscles'),

  getWorkoutHistory: (): Promise<any[]> =>
    apiClient.get('/customer/workouts/history'),

  startWorkoutSession: (payload: { workout_id?: string; name?: string }): Promise<{ session_id: string; status: string; message: string }> =>
    apiClient.post('/customer/workouts/sessions', payload),

  logWorkoutSet: (sessionId: string, payload: { exercise_id?: string; exercise_name?: string; set_number: number; reps_completed: number; weight_kg: number; rpe?: number }): Promise<{ status: string; logged_set_id: string }> =>
    apiClient.post(`/customer/workouts/sessions/${sessionId}/sets`, payload),

  completeWorkoutSession: (sessionId: string): Promise<{ status: string; message: string; next_recommendation: string }> =>
    apiClient.post(`/customer/workouts/sessions/${sessionId}/complete`, {}),

  getTodaysNutrition: (): Promise<CustomerNutritionData> =>
    apiClient.get<CustomerNutritionData>('/customer/nutrition/today'),

  scanFood: (imagePayload: { image_base64?: string }): Promise<FoodScanResult> =>
    apiClient.post<FoodScanResult>('/customer/nutrition/food-scan', imagePayload),

  confirmFoodScan: (scanId: string, payload: { meal_name: string; meal_type: string; total: FoodScanResult['total'] }): Promise<{ status: string; message: string }> =>
    apiClient.post<{ status: string; message: string }>(`/customer/nutrition/food-scans/${scanId}/confirm`, payload),

  getAICoachRecommendation: (): Promise<AICoachRecommendation> =>
    apiClient.get<AICoachRecommendation>('/customer/ai/recommendation'),

  analyzeNutritionTargets: (payload: AnalyzeTargetsPayload): Promise<AITargetRecommendation> =>
    apiClient.post<AITargetRecommendation>('/customer/nutrition/analyze-targets', payload),

  simulateTransformation: (payload: { body_condition: string; before_image?: string; target_weight_kg?: number; current_weight_kg?: number; height_cm?: number; gender?: string }): Promise<TransformationResponse> =>
    apiClient.post<TransformationResponse>('/customer/transformation/simulate', payload),

  saveTransformation: (payload: Partial<TransformationResponse>): Promise<{ status: string; transformation_id: string; message: string }> =>
    apiClient.post<{ status: string; transformation_id: string; message: string }>('/customer/transformation/save', payload),

  getTransformationHistory: (): Promise<SavedTransformationRecord[]> =>
    apiClient.get<SavedTransformationRecord[]>('/customer/transformation/history'),
};
