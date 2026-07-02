import html
import json

import gradio as gr

DEFAULT_MANIFEST = {
   "title": "Neon Ghost",
   "scenes": [
       {
           "startBeat": 0,
           "endBeat": 16,
           "character": "hero",
           "faceVideo": "models/synthv/hero_idle.mp4",
           "rvcModel": "models/rvc/hero.pth",
       },
       {
           "startBeat": 16,
           "endBeat": 32,
           "character": "villain",
           "faceVideo": "models/synthv/villain_closeup.mp4",
           "rvcModel": "models/rvc/villain.pth",
       },
   ],
}


def parse_manifest(scene_manifest_json):
   if not scene_manifest_json or not str(scene_manifest_json).strip():
       return {"title": "local-studio", "scenes": []}

   try:
       payload = json.loads(scene_manifest_json)
   except json.JSONDecodeError as exc:
       return {"title": "local-studio", "scenes": [], "_error": f"Invalid scene manifest JSON: {exc}"}

   if not isinstance(payload, dict):
       return {"title": "local-studio", "scenes": [], "_error": "Scene manifest must be a JSON object."}

   scenes = payload.get("scenes", [])
   if not isinstance(scenes, list):
       return {"title": "local-studio", "scenes": [], "_error": "Scene manifest must contain a scenes array."}

   return payload


def render_thumbnail(scene, index):
   character = scene.get("character") or f"Scene {index + 1}"
   face_video = scene.get("faceVideo") or "No face video"
   start_beat = scene.get("startBeat", "?")
   end_beat = scene.get("endBeat", "?")
   summary = face_video.split("/")[-1]
   return f"""
   <div class=\"scene-card\">
     <div class=\"scene-thumb\" style=\"background: linear-gradient(135deg, #{(index * 97 + 29) % 256:02x}{(index * 113 + 71) % 256:02x}{(index * 83 + 143) % 256:02x});\">
       <span>{index + 1}</span>
     </div>
     <div class=\"scene-meta\">
       <strong>{html.escape(str(character))}</strong>
       <div>{html.escape(str(summary))}</div>
       <div>Beats {start_beat}–{end_beat}</div>
     </div>
   </div>
   """


def render_scene_preview_html(scenes):
   if not scenes:
       return "<div class=\"empty-state\">Add at least one scene to preview the local studio workflow.</div>"

   cards = "".join(render_thumbnail(scene, index) for index, scene in enumerate(scenes))
   return f"""
   <div class=\"scene-grid\">{cards}</div>
   <style>
     .scene-grid {{ display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }}
     .scene-card {{ border: 1px solid #d0d7de; border-radius: 12px; padding: 0.75rem; background: #ffffff; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06); }}
     .scene-thumb {{ align-items: center; border-radius: 10px; color: white; display: flex; font-size: 1.3rem; font-weight: 700; height: 86px; justify-content: center; margin-bottom: 0.6rem; }}
     .scene-meta {{ color: #334155; display: grid; gap: 0.2rem; font-size: 0.95rem; }}
     .empty-state {{ color: #475569; font-style: italic; }}
   </style>
   """


def build_plan_status(scene_manifest_json, output_dir):
   manifest = parse_manifest(scene_manifest_json)
   scenes = manifest.get("scenes", [])

   if manifest.get("_error"):
       return (
           manifest["_error"],
           "<div class=\"empty-state\">The manifest could not be loaded.</div>",
           gr.update(choices=[], value=None),
           "No scene selected.",
       )

   scene_count = len(scenes)
   output_path = (output_dir or "output/local-studio").strip() or "output/local-studio"
   status = f"Ready to launch a local studio run with {scene_count} scene(s) into {output_path}."

   choices = []
   for index, scene in enumerate(scenes):
       character = scene.get("character") or f"Scene {index + 1}"
       choices.append((f"{character} · Scene {index + 1}", f"scene-{index}"))

   selected_value = choices[0][1] if choices else None
   preview_html = render_scene_preview_html(scenes)
   selected_summary = describe_selected_scene(scene_manifest_json, selected_value)

   return (
       status,
       preview_html,
       gr.update(choices=choices, value=selected_value),
       selected_summary,
   )


def describe_selected_scene(scene_manifest_json, selected_value):
   manifest = parse_manifest(scene_manifest_json)
   scenes = manifest.get("scenes", [])

   if not scenes:
       return "No scenes available in the manifest."

   if not selected_value:
       selected_scene = scenes[0]
   else:
       try:
           selected_index = int(selected_value.split("-", 1)[1])
       except (IndexError, ValueError):
           selected_index = 0
       selected_scene = scenes[selected_index] if 0 <= selected_index < len(scenes) else scenes[0]

   character = selected_scene.get("character") or "scene"
   start_beat = selected_scene.get("startBeat", "?")
   end_beat = selected_scene.get("endBeat", "?")
   face_video = selected_scene.get("faceVideo") or "No face video"
   rvc_model = selected_scene.get("rvcModel") or "No RVC model"
   return (
       f"Selected character: **{html.escape(str(character))}**\n"
       f"- Beats: {start_beat}–{end_beat}\n"
       f"- Face video: {html.escape(str(face_video))}\n"
       f"- RVC model: {html.escape(str(rvc_model))}"
   )


with gr.Blocks() as demo:
   gr.Markdown("# Lumi Local Studio")
   gr.Markdown("This lightweight UI exposes the local AI MV pipeline plan for Docker-based local generation with scene-preview cards and a character selector.")
   scenes = gr.Textbox(label="Scene manifest JSON", lines=12, value=json.dumps(DEFAULT_MANIFEST, indent=2))
   output_dir = gr.Textbox(label="Output directory", value="output/local-studio")
   run = gr.Button("Generate plan")
   output = gr.Textbox(label="Pipeline status")
   preview = gr.HTML(value="<div class=\"empty-state\">Generate a plan to preview scenes.</div>")
   character_selector = gr.Dropdown(label="Character selector", choices=[], value=None, interactive=True)
   selection_details = gr.Markdown(value="No scene selected.")

   run.click(
       build_plan_status,
       inputs=[scenes, output_dir],
       outputs=[output, preview, character_selector, selection_details],
   )
   character_selector.change(
       describe_selected_scene,
       inputs=[scenes, character_selector],
       outputs=[selection_details],
   )


demo.launch(server_name="0.0.0.0", server_port=7860)
