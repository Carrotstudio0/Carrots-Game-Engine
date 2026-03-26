# This is the CMake file used to build GDevelop.
# For more information, see the README.md file.

cmake_minimum_required(VERSION 3.5)

# Add utility functions
include(scripts/CMakeClangUtils.txt) # To add clang-format and clang-tidy support to a target

# Macro for defining an option
macro(gd_set_option var default type docstring)
	if(NOT DEFINED ${var})
		set(${var} ${default})
	endif()
	set(${var} ${${var}} CACHE ${type} ${docstring} FORCE)
endmacro()

# Set options
gd_set_option(BUILD_CORE TRUE BOOL "TRUE to build GDevelop Core library")
gd_set_option(BUILD_GDJS TRUE BOOL "TRUE to build GDevelop JS Platform")
gd_set_option(BUILD_EXTENSIONS TRUE BOOL "TRUE to build the extensions")
gd_set_option(BUILD_TESTS TRUE BOOL "TRUE to build the tests")
gd_set_option(GD_CXX_STANDARD 17 STRING "C++ standard used to build GDevelop")
gd_set_option(GD_ENABLE_IPO TRUE BOOL "TRUE to enable interprocedural optimization (LTO) for Release builds when supported")
gd_set_option(GD_ENABLE_UNITY_BUILD FALSE BOOL "TRUE to enable CMake unity builds")
gd_set_option(GD_ENABLE_FAST_MATH FALSE BOOL "TRUE to enable fast math optimizations for Release builds")
gd_set_option(GD_ENABLE_NATIVE_CPU_OPTIMIZATIONS FALSE BOOL "TRUE to optimize Release builds for the local CPU architecture")

# Disable deprecated code
set(NO_GUI TRUE CACHE BOOL "" FORCE) # Force disable old GUI related code.

# Setting up installation directory, for Linux (has to be done before "project" command).
if(NOT WIN32)
	if(NOT APPLE)
		gd_set_option(GD_INSTALL_PREFIX "/opt/gdevelop/" STRING "The directory where GDevelop should be installed")
	else()
		gd_set_option(GD_INSTALL_PREFIX "." STRING "The directory where GDevelop should be installed")
	endif()

	# As we embed SFML, prevent it to be installed system-wide
	set(CMAKE_INSTALL_PREFIX "${GD_INSTALL_PREFIX}/useless")
endif()

project(GDevelop)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
if(NOT WIN32 AND NOT APPLE AND NOT BUILD_TESTS)
	set(CMAKE_SKIP_BUILD_RPATH TRUE) # Avoid errors when packaging for linux.
endif()
if(APPLE)
	set(CMAKE_MACOSX_RPATH 1)
	set(CMAKE_INSTALL_RPATH_USE_LINK_PATH FALSE)
	set(CMAKE_INSTALL_RPATH ".")
	set(CMAKE_BUILD_WITH_INSTALL_RPATH TRUE)
	add_compile_options(
		-D_WCHAR_H_CPLUSPLUS_98_CONFORMANCE_
		-Wno-potentially-evaluated-expression)
endif()
# Sanity checks
if("${CMAKE_BUILD_TYPE}" STREQUAL "")
	message(STATUS "CMAKE_BUILD_TYPE is empty, assuming build type is Release")
	set(CMAKE_BUILD_TYPE Release)
endif()

if("${CMAKE_BUILD_TYPE}" STREQUAL "Release" AND NOT WIN32 AND CMAKE_COMPILER_IS_GNUCXX)
	set(CMAKE_SHARED_LINKER_FLAGS "-s") # Force stripping to avoid errors when packaging for linux.
endif()

# Activate modern C++
set(CMAKE_CXX_STANDARD ${GD_CXX_STANDARD})
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(GD_ENABLE_UNITY_BUILD)
	set(CMAKE_UNITY_BUILD ON)
endif()

if(GD_ENABLE_IPO AND "${CMAKE_BUILD_TYPE}" STREQUAL "Release")
	if(CMAKE_VERSION VERSION_GREATER_EQUAL "3.9")
		if(POLICY CMP0069)
			cmake_policy(SET CMP0069 NEW)
		endif()
		include(CheckIPOSupported)
		check_ipo_supported(RESULT gd_ipo_supported OUTPUT gd_ipo_error)
		if(gd_ipo_supported)
			set(CMAKE_INTERPROCEDURAL_OPTIMIZATION_RELEASE TRUE)
			message(STATUS "Interprocedural optimization (LTO) enabled for Release builds.")
		else()
			message(STATUS "Interprocedural optimization (LTO) disabled: ${gd_ipo_error}")
		endif()
	else()
		message(STATUS "Interprocedural optimization requires CMake >= 3.9.")
	endif()
endif()

if(GD_ENABLE_FAST_MATH)
	if(MSVC)
		add_compile_options($<$<CONFIG:Release>:/fp:fast>)
	elseif(CMAKE_CXX_COMPILER_ID STREQUAL "GNU" OR CMAKE_CXX_COMPILER_ID STREQUAL "Clang")
		add_compile_options($<$<CONFIG:Release>:-ffast-math> $<$<CONFIG:Release>:-fno-math-errno>)
	endif()
endif()

if(GD_ENABLE_NATIVE_CPU_OPTIMIZATIONS)
	if(MSVC)
		add_compile_options($<$<CONFIG:Release>:/arch:AVX2>)
	elseif(CMAKE_CXX_COMPILER_ID STREQUAL "GNU" OR CMAKE_CXX_COMPILER_ID STREQUAL "Clang")
		add_compile_options($<$<CONFIG:Release>:-march=native> $<$<CONFIG:Release>:-mtune=native>)
	endif()
endif()

# Mark some warnings as errors
if(CMAKE_CXX_COMPILER_ID STREQUAL "Clang")
	# Activate as much warnings as possible to avoid errors like
	# uninitialized variables or other hard to debug bugs.
	add_compile_options(
		-Wall
		-Wextra
		-Wuninitialized
		-Wconditional-uninitialized
		-Wno-unknown-warning-option
		-Wno-reorder-ctor
		-Wno-reorder
		-Wno-unused-parameter
		-Wno-pessimizing-move
		-Wno-unused-variable # Not a good style, but not a risk
		-Wno-unused-private-field
		-Wno-ignored-qualifiers # Not a risk
		-Wno-sign-compare # Not a big risk

		# Make as much warnings considered as errors as possible (only one for now).
		-Werror=return-stack-address
		-Werror=return-type)
endif()

# Define common directories:
set(GD_base_dir ${CMAKE_CURRENT_SOURCE_DIR})

# Add all the CMakeLists:
add_subdirectory(ExtLibs)
if(BUILD_CORE)
	add_subdirectory(Core)
endif()
if(BUILD_GDJS)
	add_subdirectory(GDJS)
endif()
if(EMSCRIPTEN)
	add_subdirectory(GDevelop.js)
endif()
if(BUILD_EXTENSIONS)
	add_subdirectory(Extensions)
endif()
