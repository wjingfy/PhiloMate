from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from PIL import Image, ImageOps


REPO = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = REPO / "美工素材" / "美术素材" / "美术素材"
DEFAULT_OUTPUT = REPO / "src" / "ui" / "assets"


def save_static(source: Path, target: Path, max_size: tuple[int, int], quality: int = 88) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
        return
    with Image.open(source) as opened:
        opened.seek(0)
        image = ImageOps.exif_transpose(opened.convert("RGBA" if "A" in opened.getbands() else "RGB"))
        image.thumbnail(max_size, Image.Resampling.LANCZOS)
        image.save(target, "WEBP", quality=quality, method=6)


def save_psd_composite(source: Path, target: Path, max_size: tuple[int, int]) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
        return
    with Image.open(source) as opened:
        image = opened.convert("RGBA")
        image.thumbnail(max_size, Image.Resampling.LANCZOS)
        image.save(target, "WEBP", quality=90, method=6)


def save_icon_cells(source: Path, target_dir: Path) -> None:
    """Split the labeled 4x4 PSD composite into stable, label-free icons."""
    names = (
        ("close", "back", "confirm", "settings"),
        ("window", "notebook", "career", "bag"),
        ("snackbook", "thought", "history", "send"),
        ("add", "arrange", "record", "search"),
    )
    target_dir.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as opened:
        sheet = opened.convert("RGBA")
        width, height = sheet.size
        for column in range(4):
            left = round(width * column / 4)
            right = round(width * (column + 1) / 4)
            column_image = sheet.crop((left, 0, right, height))
            alpha = column_image.getchannel("A")
            active_rows: list[tuple[int, int]] = []
            start: int | None = None
            for y in range(height):
                histogram = alpha.crop((0, y, alpha.width, y + 1)).histogram()
                populated = sum(histogram[25:]) > 1
                if populated and start is None:
                    start = y
                elif not populated and start is not None:
                    active_rows.append((start, y - 1))
                    start = None
            if start is not None:
                active_rows.append((start, height - 1))

            merged_rows: list[tuple[int, int]] = []
            for run_start, run_end in active_rows:
                if merged_rows and run_start - merged_rows[-1][1] - 1 <= 5:
                    merged_rows[-1] = (merged_rows[-1][0], run_end)
                else:
                    merged_rows.append((run_start, run_end))
            icon_rows = [(run_start, run_end) for run_start, run_end in merged_rows if run_end - run_start >= 40]
            if len(icon_rows) != 4:
                raise RuntimeError(f"could not isolate four icon rows in column {column}: {icon_rows}")

            for row, row_names in enumerate(names):
                name = row_names[column]
                target = target_dir / f"{name}.webp"
                top = max(0, icon_rows[row][0] - 6)
                bottom = min(height, icon_rows[row][1] + 7)
                cell = sheet.crop((left, top, right, bottom))
                alpha_bounds = cell.getchannel("A").getbbox()
                if alpha_bounds:
                    cell = cell.crop(alpha_bounds)
                cell.thumbnail((148, 120), Image.Resampling.LANCZOS)
                canvas = Image.new("RGBA", (160, 132), (0, 0, 0, 0))
                canvas.alpha_composite(cell, ((canvas.width - cell.width) // 2, (canvas.height - cell.height) // 2))
                canvas.save(target, "WEBP", lossless=True, method=6)


def save_animation(source: Path, target: Path, size: tuple[int, int] = (450, 800)) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
        print(f"skip animation {target.relative_to(REPO)}")
        return

    frames: list[Image.Image] = []
    durations: list[int] = []
    with Image.open(source) as opened:
        frame_count = getattr(opened, "n_frames", 1)
        for index in range(frame_count):
            opened.seek(index)
            frame = opened.convert("RGBA").resize(size, Image.Resampling.LANCZOS)
            frames.append(frame)
            durations.append(max(20, int(opened.info.get("duration", 40))))

    frames[0].save(
        target,
        "WEBP",
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        quality=76,
        method=3,
        minimize_size=True,
    )
    for frame in frames:
        frame.close()
    print(f"animation {target.relative_to(REPO)} ({target.stat().st_size / 1024 / 1024:.1f} MB)")


def copy_media(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)


def prepare(source: Path, output: Path) -> None:
    avatars = {
        "confucius": "孔子",
        "socrates": "苏格拉底",
        "wangyangming": "王阳明",
        "foucault": "福柯",
    }
    for role_id, chinese_name in avatars.items():
        save_static(source / "哲学家头像" / f"{chinese_name}.png", output / "avatars" / f"{role_id}.webp", (640, 640))
        save_static(source / "哲学家头像" / f"{chinese_name}-脸红.png", output / "avatars" / f"{role_id}-blush.webp", (640, 640))

    action_files = {
        "confucius": ["孔子动作1-cur=0.gif", "孔子动作2-cur=2or3.gif", "孔子动作3-cur=4.gif"],
        "socrates": ["苏格拉底动作1-cur=0.gif", "苏格拉底动作2-cur=2or3.gif", "苏格拉底动作3-cur=4.gif"],
        "wangyangming": ["王阳明动作1-cur=0.gif", "王阳明动作2-cur=2or3.gif", "王阳明动作3=cur=4.gif"],
        "foucault": ["福柯动作1-cur=0.gif", "福柯动作2-cur=2or3.gif", "福柯动作3-cur=4.gif"],
    }
    source_role_names = {
        "confucius": "孔子",
        "socrates": "苏格拉底",
        "wangyangming": "王阳明",
        "foucault": "福柯",
    }
    attitude_names = ("0", "2-3", "4")
    for role_id, names in action_files.items():
        for attitude_name, filename in zip(attitude_names, names):
            save_animation(
                source / "哲学家对话界面" / source_role_names[role_id] / filename,
                output / "dialogue" / "actions" / f"{role_id}-{attitude_name}.webp",
            )

    snack_sources = {
        "spicy_stick": ("通用", "辣条.png"),
        "rouxsong_xiaobei": ("通用", "肉松小贝.png"),
        "beef_jerky": ("通用", "牛肉干.png"),
        "chocolate": ("通用", "巧克力.png"),
        "boxed_milk": ("通用", "牛奶.png"),
        "socrates_diluted_wine": ("苏格拉底", "古希腊酒水.png"),
        "socrates_fig": ("苏格拉底", "无花果.png"),
        "socrates_know_thyself_bread": ("苏格拉底", "“认识你自己”面包.png"),
        "wang_mountain_tea": ("王阳明", "山茶.png"),
        "wang_longchang_fern": ("王阳明", "蕨.png"),
        "wang_liangnong_cake": ("王阳明", "方糕.png"),
        "foucault_french_basket": ("福柯", "面包奶酪酒.png"),
        "foucault_sandwich_cola": ("福柯", "可乐三明治.png"),
        "foucault_black_coffee": ("福柯", "黑咖啡.png"),
        "ginger": ("孔子", "生姜.png"),
        "dan_shi_piao_yin": ("孔子", "箪食瓢饮.png"),
        "yu_kuai": ("孔子", "生鱼片.png"),
    }
    snack_root = source / "零食分享功能"
    for snack_id, (folder, filename) in snack_sources.items():
        save_static(snack_root / folder / filename, output / "snacks" / f"{snack_id}.webp", (640, 640), 86)

    snack_icon_root = source / "零食及图鉴图标"
    for snack_id, (folder, filename) in snack_sources.items():
        stem = Path(filename).stem
        copy_media(
            snack_icon_root / folder / f"{stem}-2.png",
            output / "snack-icons" / "atlas" / f"{snack_id}.png",
        )
        copy_media(
            snack_icon_root / folder / f"{stem}-1.png",
            output / "snack-icons" / "gift" / f"{snack_id}.png",
        )

    for role_id, folder in source_role_names.items():
        role_icon_root = snack_icon_root / folder
        locked_sources = [
            path for path in role_icon_root.glob("*.png")
            if not path.stem.endswith(("-1", "-2"))
        ]
        if len(locked_sources) != 1:
            raise RuntimeError(f"expected one locked snack icon for {role_id}, found {locked_sources}")
        copy_media(
            locked_sources[0],
            output / "snack-icons" / "locked" / f"{role_id}.png",
        )

    plant_sources = {
        "seed": "00_种子期_通用.png",
        "sprout": "01_破土嫩芽_通用.png",
        "sunflower": "向日葵",
        "banyan": "榕树",
        "hoya": "球兰",
        "lily": "白百合",
        "rose": "红玫瑰",
        "hydrangea": "绣球花",
        "chrysanthemum": "菊花",
        "clematis": "铁线莲",
        "bird-of-paradise": "鹤望兰",
        "monstera": "龟背竹",
    }
    plant_root = source / "窗台" / "植物素材"
    save_static(plant_root / plant_sources["seed"], output / "window" / "plants" / "seed.webp", (720, 1000), 86)
    save_static(plant_root / plant_sources["sprout"], output / "window" / "plants" / "sprout.webp", (720, 1000), 86)
    for plant_id, chinese_name in list(plant_sources.items())[2:]:
        for stage in (1, 2, 3):
            save_static(
                plant_root / f"{chinese_name}_{stage}.png",
                output / "window" / "plants" / f"{plant_id}-{stage}.webp",
                (800, 1000),
                86,
            )

    copy_media(source / "窗台" / "阳台动态.webm", output / "window" / "balcony.webm")
    save_static(source / "废纸团功能" / "白纸条.png", output / "wastepaper" / "note.webp", (720, 720), 90)
    copy_media(source / "废纸团功能" / "纸团打开动效.gif", output / "wastepaper" / "paper-open.gif")
    save_static(source / "主动发言功能" / "哲学提问-哲思角" / "背景图plus.png", output / "features" / "thought-corner.webp", (1600, 900), 90)
    save_static(source / "主动发言功能" / "讲述经历-生涯图鉴" / "背景图.png", output / "features" / "career.webp", (1600, 900), 88)
    save_static(source / "主动发言功能" / "讲述经历-生涯图鉴" / "海鸥.png", output / "features" / "seagull.webp", (320, 320), 90)
    icon_sheet = output / "branding" / "logo.webp"
    save_psd_composite(source / "图标" / "logo.psd", icon_sheet, (640, 640))
    save_icon_cells(icon_sheet, output / "branding" / "icons")
    save_static(
        source / "哲学家选择界面" / "选择页面设计视觉效果图.png",
        output / "branding" / "selection-screen.webp",
        (2400, 1400),
        92,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare PhiloMate runtime art assets.")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    if not args.source.exists():
        raise SystemExit(f"art source not found: {args.source}")
    prepare(args.source.resolve(), args.output.resolve())
    print("ART_ASSETS_OK")


if __name__ == "__main__":
    main()
