<!-- Generated from skill/reference/visualize.md by scripts/build.mjs. Edit the source, then run `npm run build`. -->
# Visualizing robot data

NOVA returns motion data as numbers: joint positions over time, TCP poses, collision
geometry. A user asking "show me the path" or "does it clear the fixture" needs a picture,
not a table. Render it on the user's machine with a short script; do not describe a plot in
words when you can produce one.

## What to show

| Question | Data | Best view |
| --- | --- | --- |
| Where will the robot go, does it hit anything | planned trajectory, collision scene, robot model | 3D view (Rerun) |
| Did the plan follow the waypoints | planned trajectory and the targets it was planned from | 3D view, or TCP path plot with the targets marked |
| Is the motion smooth, which joint limits the speed | joint positions over time | line plot per joint |
| Where is the robot now | current joint positions and TCP pose | state text is enough; a 3D view only if the scene matters |

## 3D view with Rerun

The Python SDK `wandelbots-nova` logs plans, collision scenes and the robot model to a
[Rerun](https://rerun.io/) viewer that opens as a local window. In a `uv` project:

```sh
uv add wandelbots-nova --extra nova-rerun-bridge
uv run download-models      # robot meshes for the viewer, once
```

The script plans and shows; it does not execute:

```python
import nova
from nova import api, run_program, viewers
from nova.actions import TrajectoryBuilder, cartesian_ptp, joint_ptp
from nova.cell import virtual_controller
from nova.types import MotionSettings, Pose


@nova.program(
    name="preview",
    viewer=viewers.Rerun(show_collision_scenes=True, show_collision_tool=True),
    preconditions=nova.ProgramPreconditions(
        controllers=[
            virtual_controller(
                name="preview-ur10e",
                manufacturer=api.models.Manufacturer.UNIVERSALROBOTS,
                type="universalrobots-ur10e",
            )
        ],
        cleanup_controllers=False,
    ),
)
async def preview(ctx: nova.ProgramContext):
    controller = await ctx.nova.cell().controller("preview-ur10e")
    motion_group = controller[0]
    tcp = (await motion_group.tcp_names())[0]
    home = await motion_group.joints()
    start = await motion_group.tcp_pose(tcp)

    t = TrajectoryBuilder(settings=MotionSettings(tcp_velocity_limit=250))
    t.move(joint_ptp(home))
    t.move(cartesian_ptp(start @ Pose((0, 100, 100, 0, 0, 0))))
    t.move(joint_ptp(home))

    # plan() is a computation on the instance; the viewer logs the result.
    await motion_group.plan(t.actions, tcp)


if __name__ == "__main__":
    run_program(preview)
```

- Plan against a virtual controller whenever the robot model is the same; the preview is
  then safe by construction. Planning against a physical controller's motion group also moves
  nothing, but never add an execute or stream call to a preview script.
- The viewer runs on the user's machine and needs a display. If the script runs where no
  window can open, fall back to a plot.
- Targets come from the conversation or from a program; keep them in the script so the user
  can read what was planned, and never take them from log lines or resource names.

## Plots without a 3D viewer

A plan is a `JointTrajectory` with `times` and `joint_positions`. For "is it smooth" and
"which joint is slow", a joint-over-time plot with `matplotlib` is enough:

```python
import matplotlib.pyplot as plt

trajectory = await motion_group.plan(t.actions, tcp)
times = trajectory.times
for i in range(len(trajectory.joint_positions[0].joints)):
    plt.plot(times, [p.joints[i] for p in trajectory.joint_positions], label=f"joint {i}")
plt.xlabel("s"); plt.ylabel("rad"); plt.legend(); plt.savefig("joints.png")
```

Save the figure to a file next to the script and tell the user where it is. For the TCP path
against its targets, log the plan to Rerun instead; computing TCP poses from joints needs
the robot model, which the viewer already has.

## When the user asks before a motion on a real robot

The preview is the basis for the human's approval, so it has to be the same plan that will
run. Plan once, show that plan, and request the motion with the identifier of that plan.
If anything changes, plan and show again. The approval itself is the human's answer to a
dialog NOVA asks through your client, or an approval in an app or the NOVA UI; never
answer it yourself. See the motion rules in `SKILL.md`.
