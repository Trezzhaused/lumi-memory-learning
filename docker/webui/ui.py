import gradio as gr


def render_pipeline_plan(payload):
    if not payload:
        return "Provide a scene manifest and output directory to generate a local studio plan."
    return f"Ready to launch a local studio run with {len(payload.get('scenes', []))} scene(s)."


with gr.Blocks() as demo:
    gr.Markdown("# Lumi Local Studio")
    gr.Markdown("This lightweight UI exposes the local AI MV pipeline plan for Docker-based local generation.")
    scenes = gr.Textbox(label="Scene manifest JSON", lines=8)
    output_dir = gr.Textbox(label="Output directory", value="output/local-studio")
    run = gr.Button("Generate plan")
    output = gr.Textbox(label="Pipeline status")
    run.click(render_pipeline_plan, inputs=[scenes], outputs=[output])


demo.launch(server_name="0.0.0.0", server_port=7860)
