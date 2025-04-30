from supabase import Client
import uuid
from typing import Dict, Any, List, Optional
from ..models.user_pr import UserPr  # Assuming UserPr model includes all needed fields like distance, time_in_seconds, is_official

# Define standard distances for 'WELL_ROUNDED' check
STANDARD_DISTANCES = {'5K', '10K', 'Half Marathon', 'Marathon'}

async def check_and_award_achievements(
    supabase: Client,
    user_id: uuid.UUID,
    pr_data: UserPr # Use the full UserPr model returned after insert/update
):
    """Checks if a new/updated PR triggers any achievements for the user."""
    print(f"[AchievementService] Checking achievements for user {user_id} after PR: {pr_data.id}")
    try:
        # 1. Fetch all achievement definitions
        achievements_resp = supabase.table("achievements").select("id, code, name").execute()
        if not hasattr(achievements_resp, 'data'):
            print("[AchievementService] Error: Failed to fetch achievement definitions.")
            return
        achievements_map: Dict[str, Dict[str, Any]] = {
            a['code']: {'id': a['id'], 'name': a['name']} for a in achievements_resp.data
        }
        print(f"[AchievementService] Found {len(achievements_map)} achievement definitions.")

        # 2. Fetch user's *existing* earned achievements
        earned_resp = supabase.table("user_achievements").select("achievement_id").eq("user_id", str(user_id)).execute()
        if not hasattr(earned_resp, 'data'):
            print(f"[AchievementService] Error: Failed to fetch earned achievements for user {user_id}.")
            return
        earned_achievement_ids = {e['achievement_id'] for e in earned_resp.data}
        print(f"[AchievementService] User {user_id} has {len(earned_achievement_ids)} existing achievements.")


        # 3. Fetch user's relevant PR history
        # Need count for FIRST_PR_LOGGED, other PRs for PERSONAL_BEST, distinct distances for WELL_ROUNDED
        pr_history_resp = supabase.table("user_prs") \
            .select("id, distance, time_in_seconds") \
            .eq("user_id", str(user_id)) \
            .execute()

        if not hasattr(pr_history_resp, 'data'):
             print(f"[AchievementService] Error: Failed to fetch PR history for user {user_id}.")
             return
        
        user_prs: List[Dict[str, Any]] = pr_history_resp.data
        pr_count = len(user_prs)
        print(f"[AchievementService] User {user_id} has {pr_count} total PRs.")


        # --- Achievement Logic ---
        achievements_to_award: List[Dict[str, Any]] = []

        def check_and_add(code: str):
            """Helper to check if achievement exists, isn't earned, and adds it to the list."""
            if code in achievements_map:
                achievement_id = achievements_map[code]['id']
                if achievement_id not in earned_achievement_ids:
                    achievements_to_award.append({
                        "user_id": str(user_id),
                        "achievement_id": achievement_id
                    })
                    # Add to earned set immediately to prevent duplicate checks in this run
                    earned_achievement_ids.add(achievement_id) 
                    print(f"[AchievementService] Queued achievement: {code} ({achievement_id})")

        # -- Participation --
        if pr_count == 1: # This PR is the first one ever
            check_and_add('FIRST_PR_LOGGED')

        if pr_data.is_official:
            # Check if this is the *first* official PR
            first_official = True
            for pr in user_prs:
                 # Need to fetch 'is_official' in history query if we want to be precise
                 # For now, assume if any *other* PR was official, this isn't the first
                 # A more accurate check would involve fetching is_official in the history.
                 # Let's assume for now we check against the definition.
                 pass # Simple check for now: if the current one is official, check definition
            check_and_add('OFFICIAL_RACER') # Simplification: award if this one is official and not earned yet

        # -- Distance Milestones --
        # Check if this is the first PR for specific distances
        first_for_distance = True
        for pr in user_prs:
            if pr['id'] != pr_data.id and pr['distance'] == pr_data.distance:
                first_for_distance = False
                break
        
        if first_for_distance:
            distance_code_map = {
                '5K': '5K_FINISHER',
                '10K': '10K_FINISHER',
                'Half Marathon': 'HALF_MARATHONER',
                'Marathon': 'MARATHONER',
                # Add Ultra check - needs mapping from specific distances
            }
            ultra_distances = {'50K', '50 Miles', '100K', '100 Miles'} # Example ultra distances

            if pr_data.distance in distance_code_map:
                check_and_add(distance_code_map[pr_data.distance])
            elif pr_data.distance in ultra_distances:
                 check_and_add('ULTRA_RUNNER')

        # -- Performance Milestones --
        if pr_data.distance == '5K' and pr_data.time_in_seconds < (25 * 60):
            check_and_add('SPEEDY_5K')
        if pr_data.distance == 'Half Marathon' and pr_data.time_in_seconds < (2 * 60 * 60):
             check_and_add('SUB_2_HALF')
        if pr_data.distance == 'Marathon' and pr_data.time_in_seconds < (3 * 60 * 60):
            check_and_add('BQ_CONTENDER')

        # -- Consistency/Improvement --
        # WELL_ROUNDED: Check distinct standard distances
        logged_standard_distances = {pr['distance'] for pr in user_prs if pr['distance'] in STANDARD_DISTANCES}
        if len(logged_standard_distances) >= 3:
            check_and_add('WELL_ROUNDED')

        # PERSONAL_BEST: Check if this time beats previous best for the same distance
        previous_best_time: Optional[int] = None
        for pr in user_prs:
             if pr['id'] != pr_data.id and pr['distance'] == pr_data.distance:
                 if previous_best_time is None or pr['time_in_seconds'] < previous_best_time:
                     previous_best_time = pr['time_in_seconds']
        
        if previous_best_time is not None and pr_data.time_in_seconds < previous_best_time:
            check_and_add('PERSONAL_BEST')


        # 4. Insert newly earned achievements
        if achievements_to_award:
            print(f"[AchievementService] Awarding {len(achievements_to_award)} achievements to user {user_id}.")
            insert_resp = supabase.table("user_achievements").insert(achievements_to_award).execute()
            if not hasattr(insert_resp, 'data'):
                print(f"[AchievementService] Error: Failed to insert earned achievements for user {user_id}. Response: {insert_resp}")
            else:
                 print(f"[AchievementService] Successfully awarded achievements.")

    except Exception as e:
        # Log error but don't crash the PR creation/update process
        print(f"[AchievementService] CRITICAL ERROR checking/awarding achievements for user {user_id}: {e}") 